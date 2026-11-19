const { createNewConfiguration } = require('../recurring-steps/migration-utils');

async function executeInitializeModelContentConfig(db) {
    console.log('🔄 Executing initialize model content config...');
    try{
        const fixedID = 'a6bcc9e0-5d5a-4088-b7db-91cd9db3df9b';
        const type = 'MODEL_CONTENT';
        const keys = {
            ttl_minutes: 24*60,
            repo_url: 'https://raw.githubusercontent.com/CBIIT/crdc-datahub-models',
            content_path: 'cache/content.json'
        }
        const result = await createNewConfiguration(db, fixedID, type, keys);
                if (result.success) {
            console.log('✅ Initialize model content config completed successfully');
        } else {
            console.log('❌ Initialize model content config failed');
        }
        return result;
    } catch (error) {
        console.error('❌ Error executing initialize model content config:', error.message);
        return { success: false, error: error.message };
    }
}
    
module.exports = {
    executeInitializeModelContentConfig
}



