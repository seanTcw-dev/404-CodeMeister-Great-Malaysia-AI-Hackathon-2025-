import json
import boto3
import base64
import os
from datetime import datetime
import re

def lambda_handler(event, context):
    """
    Lambda function to ingest PDF documents using DynamoDB instead of OpenSearch
    - Handles both API Gateway and S3 events
    - Stores metadata in DynamoDB for searching
    """
    
    # Initialize AWS clients
    s3_client = boto3.client('s3')
    dynamodb = boto3.resource('dynamodb')
    
    # Get environment variables
    bucket_name = os.environ.get('S3_BUCKET_NAME', 'medical-docs-hackatown-2025')
    table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'medical-documents')
    
    try:
        # Get DynamoDB table
        table = dynamodb.Table(table_name)
        
        # Check if this is an S3 event trigger
        if 'Records' in event and event['Records'] and 's3' in event['Records'][0]:
            return handle_s3_event(event, s3_client, table, bucket_name)
        else:
            return handle_api_event(event, s3_client, table, bucket_name)
            
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def handle_s3_event(event, s3_client, table, bucket_name):
    """Handle S3 bucket trigger events"""
    
    # Get the uploaded file info from S3 event
    s3_record = event['Records'][0]['s3']
    object_key = s3_record['object']['key']
    event_bucket = s3_record['bucket']['name']
    
    print(f"Processing S3 event: Bucket={event_bucket}, Key={object_key}")
    
    # Only process PDF files
    if not object_key.lower().endswith('.pdf'):
        print(f"Skipping non-PDF file: {object_key}")
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Non-PDF file skipped'})
        }
    
    try:
        # Get the PDF file from S3
        response = s3_client.get_object(Bucket=event_bucket, Key=object_key)
        pdf_bytes = response['Body'].read()
        
        # Extract metadata from filename and path
        filename = object_key.split('/')[-1]
        
        # Enhanced patient ID extraction
        patient_id = extract_patient_id(filename)
        
        # Extract additional metadata from filename
        metadata = extract_metadata_from_filename(filename)
        
        # Get document type from metadata or default
        document_type = response.get('Metadata', {}).get('document_type', metadata.get('document_type', 'medical_record'))
        
        # Create document ID
        document_id = f"{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(object_key) % 10000}"
        
        # Extract tags from metadata or use provided tags
        tags = extract_tags_from_metadata(metadata, document_type, filename)
        
        # Prepare metadata for DynamoDB
        document_metadata = {
            'document_id': document_id,
            'patient_id': patient_id,
            'filename': filename,
            's3_key': object_key,
            's3_bucket': event_bucket,
            'document_type': document_type,
            'upload_timestamp': datetime.now().isoformat(),
            'file_size': len(pdf_bytes),
            'source': 's3-trigger',
            'search_text': generate_search_text(filename, patient_id, document_type, metadata),
            'template_type': metadata.get('template_type', 'Unknown'),
            'date_extracted': metadata.get('date', ''),
            'created_date': datetime.now().strftime('%Y-%m-%d'),
            'tags': tags,  # Add tags for better categorization
            'tag_search_text': ' '.join(tags).lower()  # Dedicated tag search field
        }
        
        # Store in DynamoDB
        table.put_item(Item=document_metadata)
        
        print(f"Successfully indexed document: {filename} for patient: {patient_id}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processed successfully',
                's3_key': object_key,
                'patient_id': patient_id,
                'filename': filename,
                'document_id': document_id
            })
        }
        
    except Exception as e:
        print(f"Error processing S3 event: {str(e)}")
        raise e

def handle_api_event(event, s3_client, table, bucket_name):
    """Handle API Gateway events"""
    
    # Parse the request body
    if isinstance(event.get('body'), str):
        body = json.loads(event['body'])
    else:
        body = event.get('body', {})
    
    # Extract PDF data and metadata
    pdf_base64 = body.get('pdf_data')
    filename = body.get('filename', f"document_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    patient_id = body.get('patient_id', 'unknown')
    document_type = body.get('document_type', 'medical_record')
    
    if not pdf_base64:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No PDF data provided'})
        }
    
    # Decode base64 PDF
    pdf_bytes = base64.b64decode(pdf_base64)
    
    # Extract metadata from filename if possible
    metadata = extract_metadata_from_filename(filename)
    if patient_id == 'unknown' and metadata.get('patient_id'):
        patient_id = metadata['patient_id']
    
    # Upload to S3
    s3_key = f"documents/{patient_id}/{filename}"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=pdf_bytes,
        ContentType='application/pdf',
        Metadata={
            'patient_id': patient_id,
            'document_type': document_type,
            'upload_timestamp': datetime.now().isoformat()
        }
    )
    
    # Create document ID
    document_id = f"{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(s3_key) % 10000}"
    
    # Extract tags from metadata or use provided tags
    tags = extract_tags_from_metadata(metadata, document_type, filename)
    
    # Prepare metadata for DynamoDB
    document_metadata = {
        'document_id': document_id,
        'patient_id': patient_id,
        'filename': filename,
        's3_key': s3_key,
        's3_bucket': bucket_name,
        'document_type': document_type,
        'upload_timestamp': datetime.now().isoformat(),
        'file_size': len(pdf_bytes),
        'source': 'api-upload',
        'search_text': generate_search_text(filename, patient_id, document_type, metadata),
        'template_type': metadata.get('template_type', 'Unknown'),
        'date_extracted': metadata.get('date', ''),
        'created_date': datetime.now().strftime('%Y-%m-%d'),
        'tags': tags,  # Add tags for better categorization
        'tag_search_text': ' '.join(tags).lower()  # Dedicated tag search field
    }
    
    # Store in DynamoDB
    table.put_item(Item=document_metadata)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Document uploaded successfully',
            's3_key': s3_key,
            'patient_id': patient_id,
            'filename': filename,
            'document_id': document_id
        })
    }

def extract_patient_id(filename):
    """Extract patient ID from filename using various patterns"""
    
    # Pattern 1: PXXX_Name format (e.g., P201_Margaret-Robbins)
    pattern1 = re.search(r'^(P\d+)', filename)
    if pattern1:
        return pattern1.group(1)
    
    # Pattern 2: Name format with patient ID in parentheses
    pattern2 = re.search(r'\((P\d+)\)', filename)
    if pattern2:
        return pattern2.group(1)
    
    # Pattern 3: Any P followed by numbers
    pattern3 = re.search(r'P(\d+)', filename)
    if pattern3:
        return f"P{pattern3.group(1)}"
    
    return 'unknown'

def extract_tags_from_metadata(metadata, document_type, filename):
    """Extract intelligent tags from document metadata"""
    tags = []
    if document_type and document_type != 'medical_record':
        tags.append(document_type)
    if metadata.get('template_type'):
        tags.append(metadata['template_type'])
    if metadata.get('patient_name'):
        tags.append(f"patient_{metadata['patient_name'].replace(' ', '_')}")
    tags.append('medical_records')  # Default
    return tags

def extract_metadata_from_filename(filename):
    """Extract metadata from filename patterns"""
    
    metadata = {}
    
    # Extract template type (Template_A or Template_B)
    template_match = re.search(r'(Template_[A-Z])', filename)
    if template_match:
        metadata['template_type'] = template_match.group(1)
    
    # Extract date (YYYY-MM-DD format)
    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', filename)
    if date_match:
        metadata['date'] = date_match.group(1)
    
    # Extract patient name (if in PXXX_First-Last format)
    name_match = re.search(r'^P\d+_([A-Za-z-]+)', filename)
    if name_match:
        metadata['patient_name'] = name_match.group(1).replace('-', ' ')
    
    return metadata

def generate_search_text(filename, patient_id, document_type, metadata):
    """Generate searchable text using patientId_patientName format for reliable matching"""
    
    # Core search text: patientId_patientName format (most reliable)
    patient_name = metadata.get('patient_name', '')
    core_search = f"{patient_id}_{patient_name}".lower()
    
    # Additional searchable components
    search_parts = [
        core_search,  # Primary: patientId_patientName
        filename.lower(),  # Secondary: full filename
        document_type.lower().replace('_', ' '),  # Document type
        metadata.get('template_type', '').lower()  # Template type
    ]
    
    # Remove empty strings and join with spaces
    search_text = ' '.join([part for part in search_parts if part])
    
    return search_text