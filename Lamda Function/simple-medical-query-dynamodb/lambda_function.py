import json
import boto3
import os
import re
from boto3.dynamodb.conditions import Attr
from decimal import Decimal

def decimal_default(obj):
    """Convert Decimal to int/float for JSON serialization"""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    elif isinstance(obj, set):
        return list(obj)
    elif hasattr(obj, 'item'):
        return obj.item()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def lambda_handler(event, context):
    """
    Simple Lambda function to query medical documents using DynamoDB
    - Searches DynamoDB for relevant documents
    - Returns matching results with metadata
    """
    
    # Get DynamoDB table name from environment variables
    table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'medical-documents')
    
    try:
        # Initialize DynamoDB
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # Parse the request
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        # Support both 'query' and 'question' fields for compatibility
        query = body.get('query', '') or body.get('question', '')
        patient_id = body.get('patient_id')
        
        if not query:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': 'https://main.d3p9yg8d0opcj0.amplifyapp.com',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({'error': 'No query provided'}, default=decimal_default)
            }
        
        # Search DynamoDB
        results = search_documents(table, query, patient_id)
        
        # Debug: Check for Decimal values in results
        print(f"Search results: {results}")
        
        # Convert any Decimal values in results before JSON serialization
        for result in results:
            for key, value in result.items():
                if isinstance(value, Decimal):
                    result[key] = decimal_default(value)
        
        return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': 'https://main.d3p9yg8d0opcj0.amplifyapp.com',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({
                    'query': query,
                    'results_count': len(results),
                    'results': results
                }, default=decimal_default)
            }
        
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return {
                'statusCode': 500,
                'headers': {
                    'Access-Control-Allow-Origin': 'https://main.d3p9yg8d0opcj0.amplifyapp.com',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({'error': str(e)}, default=decimal_default)
            }

def search_documents(table, query, patient_id=None):
    """Search documents in DynamoDB using filter expressions"""
    
    try:
        # Prepare search terms
        search_terms = query.lower().split()
        
        # Build filter expression
        filter_expression = None
        
        # Add patient filter if specified
        if patient_id:
            filter_expression = Attr('patient_id').eq(patient_id)
        
        # Add search text filters for each term
        for term in search_terms:
            term_filter = Attr('search_text').contains(term)
            if filter_expression:
                filter_expression = filter_expression & term_filter
            else:
                filter_expression = term_filter
        
        # If no filter expression, search all with limit
        if filter_expression:
            response = table.scan(
                FilterExpression=filter_expression,
                Limit=50  # Limit results for performance
            )
        else:
            response = table.scan(Limit=50)
        
        # Process results
        items = response.get('Items', [])
        
        # Additional filtering if needed
        filtered_items = []
        for item in items:
            # Score the relevance
            score = calculate_relevance_score(item, search_terms)
            
            if score > 0:  # Only include items with some relevance
                filtered_items.append({
                    'document_id': item.get('document_id'),
                    'patient_id': item.get('patient_id'),
                    'filename': item.get('filename'),
                    'document_type': item.get('document_type'),
                    'upload_timestamp': item.get('upload_timestamp'),
                    's3_key': item.get('s3_key'),
                    's3_bucket': item.get('s3_bucket'),
                    'file_size': item.get('file_size'),
                    'template_type': item.get('template_type'),
                    'date_extracted': item.get('date_extracted'),
                    'score': score
                })
        
        # Sort by relevance score (descending)
        filtered_items.sort(key=lambda x: x['score'], reverse=True)
        
        # Limit to top 10 results
        return filtered_items[:10]
        
    except Exception as e:
        print(f"Error searching documents: {str(e)}")
        raise e

def calculate_relevance_score(item, search_terms):
    """Calculate relevance score based on search terms"""
    
    score = 0
    search_text = item.get('search_text', '').lower()
    filename = item.get('filename', '').lower()
    patient_id = item.get('patient_id', '').lower()
    
    for term in search_terms:
        # Higher score for filename matches
        if term in filename:
            score += 3
        
        # Medium score for patient ID matches
        if term in patient_id:
            score += 2
        
        # Lower score for general search text matches
        if term in search_text:
            score += 1
    
    # Bonus for exact filename matches
    if any(term == filename.split('.')[0] for term in search_terms):
        score += 5
    
    # Bonus for exact patient ID matches
    if patient_id in search_terms:
        score += 3
    
    return score

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