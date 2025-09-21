/**
 * RAG Lambda Function Integration
 * Direct calls to simple-medical-query-dynamodb Lambda function for document retrieval
 */

class RAGLambdaClient {
    constructor() {
        this.apiUrl = 'https://tt9zsr0i5i.execute-api.us-east-1.amazonaws.com/v1/query';
        this.defaultPatientId = 'P201';
        this.bucketName = 'medical-docs-hackatown-2025';
        this.prefix = 'medical-documents/P201_Margaret_Robbins/';
        this.patientName = 'Margaret Robbins'; // Default name
    }

    /**
     * Query Lambda function for specific patient documents
     * @param {string} query - The search query
     * @param {string} patientId - Patient ID (defaults to P201 for Margaret Robbins)
     * @returns {Promise<Object>} Lambda response with documents
     */
    async queryPatientDocuments(query, patientId = this.defaultPatientId) {
        try {
            console.log(`Querying Lambda for patient ${patientId}: ${query}`);
            
            const requestBody = {
                query: query,
                patient_id: patientId,
                mode: 'patient_specific',
                source: 's3_bucket',
                bucket: this.bucketName,
                prefix: this.prefix
            };
            
            console.log('Sending request to Lambda:', {
                url: this.apiUrl,
                method: 'POST',
                body: requestBody
            });
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-api-key': 'YOUR_API_KEY' // Add if your API Gateway requires an API key
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('Received response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Lambda response received:', data);

            // Handle different response formats
            if (data.body) {
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    success: true,
                    query: bodyData.query || query,
                    results_count: bodyData.results_count || 0,
                    results: bodyData.results || [],
                    sources: bodyData.sources || []
                };
            }

            return {
                success: true,
                query: data.query || query,
                results_count: data.results_count || 0,
                results: data.results || [],
                sources: data.sources || []
            };

        } catch (error) {
            console.error('Error querying Lambda function:', {
                error: error.message,
                stack: error.stack,
                query: query,
                patientId: patientId
            });
            
            // Try to get more details from the response if available
            let errorDetails = error.message;
            if (error.response) {
                try {
                    const errorBody = await error.response.json();
                    console.error('Error response body:', errorBody);
                    errorDetails = errorBody.message || JSON.stringify(errorBody);
                } catch (e) {
                    console.error('Could not parse error response:', e);
                }
            }
            
            return {
                success: false,
                error: `Failed to query patient documents: ${errorDetails}`,
                query: query,
                results_count: 0,
                results: [],
                sources: []
            };
        }
    }

    /**
     * Query Margaret Robbins (P201) specific documents
     * @param {string} query - The search query for Margaret Robbins documents
     * @returns {Promise<Object>} Lambda response with P201 documents
     */
    async queryMargaretRobbinsDocuments(query) {
        return await this.queryPatientDocuments(query, 'P201');
    }

    /**
     * Get longitudinal history for a patient by querying multiple document types
     * @param {string} patientId - Patient ID
     * @returns {Promise<Object>} Comprehensive document analysis
     */
    async getLongitudinalHistory(patientId = this.defaultPatientId) {
        const queries = [
            'medical history timeline progression',
            'lab results trends over time',
            'treatment plan evolution',
            'medication changes history',
            'specialist consultation notes'
        ];

        const results = [];
        for (const query of queries) {
            const result = await this.queryPatientDocuments(query, patientId);
            if (result.success && result.results.length > 0) {
                results.push({
                    query: query,
                    documents: result.results
                });
            }
        }

        return {
            patient_id: patientId,
            total_queries: queries.length,
            successful_queries: results.length,
            longitudinal_data: results,
            summary: this.generateLongitudinalSummary(results)
        };
    }

    /**
     * Generate a summary from longitudinal data
     * @param {Array} data - Array of query results
     * @returns {string} Summary text
     */
    generateLongitudinalSummary(data) {
        if (data.length === 0) {
            return 'No longitudinal data found for this patient.';
        }

        const summary = [];
        summary.push(`Found ${data.length} categories of longitudinal data.`);
        
        data.forEach(category => {
            summary.push(`\n**${this.formatQueryName(category.query)}:**`);
            summary.push(`- Retrieved ${category.documents.length} relevant documents`);
            
            // Add key findings from first few documents
            const keyDocs = category.documents.slice(0, 2);
            keyDocs.forEach(doc => {
                if (doc.filename) {
                    summary.push(`  • ${doc.filename} (${doc.document_type || 'Unknown Type'})`);
                }
            });
        });

        return summary.join('\n');
    }

    /**
     * Format query name for display
     * @param {string} query - Raw query string
     * @returns {string} Formatted name
     */
    formatQueryName(query) {
        return query.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    /**
     * Format Lambda results for chat display
     * @param {Object} lambdaResults - Results from Lambda function
     * @returns {Object} Formatted response for chat interface
     */
    formatResultsForChat(lambdaResults) {
        if (!lambdaResults.success) {
            return {
                text: `I encountered an error while searching the medical documents: ${lambdaResults.error}`,
                type: 'error',
                sources: []
            };
        }

        if (lambdaResults.results_count === 0) {
            return {
                text: `I searched through the medical documents but didn't find any relevant information for "${lambdaResults.query}".`,
                type: 'normal',
                sources: []
            };
        }

        let responseText = `I found ${lambdaResults.results_count} relevant documents for "${lambdaResults.query}":\n\n`;
        
        lambdaResults.results.forEach((doc, index) => {
            responseText += `${index + 1}. **${doc.filename || 'Unknown Document'}**\n`;
            responseText += `   - Type: ${doc.document_type || 'Unknown'}\n`;
            responseText += `   - Date: ${doc.date_extracted || 'Unknown'}\n`;
            if (doc.s3_key) {
                responseText += `   - Location: ${doc.s3_bucket}/${doc.s3_key}\n`;
            }
            responseText += '\n';
        });

        return {
            text: responseText,
            type: 'normal',
            sources: lambdaResults.results.map(doc => ({
                document_id: doc.document_id,
                filename: doc.filename,
                page: 1, // Default page for now
                confidence: doc.score || 0.8
            }))
        };
    }
}

// Create global instance
const ragLambdaClient = new RAGLambdaClient();

// Initialize patient information when the script loads
async function initializePatientInfo() {
    try {
        // Query for patient information
        const results = await ragLambdaClient.queryPatientDocuments("patient's full name");
        if (results.success && results.results.length > 0) {
            // Extract patient name from the first result if available
            const nameMatch = results.results[0].text_content.match(/Patient Name[:\s]+([\w\s]+)/i);
            if (nameMatch && nameMatch[1]) {
                ragLambdaClient.patientName = nameMatch[1].trim();
            }
        }
    } catch (error) {
        console.error('Error initializing patient info:', error);
    }
    
    // Update greeting with patient name if available
    const greetingElement = document.querySelector('.chat-welcome-message');
    if (greetingElement) {
        greetingElement.innerHTML = `
            <h2>Hello, ${ragLambdaClient.patientName}!</h2>
            <p>I'm your AI Clinical Co-pilot. I have access to your medical records and I'm here to help you with your healthcare needs.</p>
            <p>You can ask me questions about:</p>
            <ul>
                <li>Your medical history</li>
                <li>Test results</li>
                <li>Medication information</li>
                <li>And any other health-related questions</li>
            </ul>
            <p>What would you like to know today?</p>
        `;
    }
}

// Initialize patient information when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePatientInfo);
} else {
    initializePatientInfo();
}

/**
 * Handle RAG queries for the Longitudinal History session
 * This function is called when users interact with the "Longitudinal History (Deep Data)" session
 */
async function handleLongitudinalHistoryRAG(query, patientId = 'P201') {
    console.log(`Handling RAG query for Longitudinal History: ${query}`);
    
    // Show thinking indicator
    showThinkingIndicator();
    
    try {
        // Query the Lambda function for Margaret Robbins documents
        const results = await ragLambdaClient.queryMargaretRobbinsDocuments(query);
        
        // Format results for chat display
        const formattedResponse = ragLambdaClient.formatResultsForChat(results);
        
        // Hide thinking indicator
        hideThinkingIndicator();
        
        // Return the formatted response
        return formattedResponse;
        
    } catch (error) {
        console.error('Error in longitudinal history RAG:', error);
        hideThinkingIndicator();
        
        return {
            text: `I encountered an error while accessing the longitudinal medical records: ${error.message}`,
            type: 'error',
            sources: []
        };
    }
}

/**
 * Initialize RAG functionality for longitudinal history session
 * This should be called when the Longitudinal History session is activated
 */
function initializeLongitudinalHistoryRAG() {
    console.log('Initializing RAG functionality for Longitudinal History session');
    
    // Add custom RAG handler for this session
    if (currentSession && currentSession.sessionName === 'Longitudinal History (Deep Data)') {
        // Override the default message handler for this session
        currentSession.ragHandler = handleLongitudinalHistoryRAG;
        console.log('RAG handler attached to longitudinal history session');
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RAGLambdaClient, ragLambdaClient, handleLongitudinalHistoryRAG };
}