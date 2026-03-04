const {DatabaseConnector} = require("./database-connector");

module.exports = {
    async MongoDBHealthCheck(connectionString){
        const connection = new DatabaseConnector(connectionString)
        try{
            await connection.connect()
            await connection.client.db("admin").command({ ping: 1 });
            console.log("MongoDB health check passed");
            return true
        }
        catch (err){
            console.error("MongoDB health check failed");
        }
        finally {
            await connection.disconnect();
        }
        return false;
    }
}
