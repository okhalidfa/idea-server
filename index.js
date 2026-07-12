const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const dotenv = require("dotenv"); 

dotenv.config(); 
const cors = require("cors");

const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

  

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,



  }
});





const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.decoded = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("ideavault");
    const ideaCollection = db.collection("ideas");
    const commentCollection = db.collection("comments");

    app.get("/ideas", async (req, res) => {
      const { search, category, limit, startDate, endDate } = req.query;
      const query = {};

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      if (category) {
        query.category = category;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      let cursor = ideaCollection.find(query).sort({ createdAt: -1 });
      if (limit) cursor = cursor.limit(Number(limit));

      const result = await cursor.toArray();
      res.json(result);
    });

    app.get("/ideas/trending", async (req, res) => {
      const result = await ideaCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.json(result);
    });

    app.get("/ideas/mine/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await ideaCollection
        .find({ authorEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    });

    app.get("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await ideaCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/ideas", verifyToken, async (req, res) => {
      const ideaData = req.body;
      ideaData.createdAt = new Date();
      const result = await ideaCollection.insertOne(ideaData);
      res.json(result);
    });
    app.patch("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await ideaCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.json(result);
    });

    app.delete("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await ideaCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get("/comments/:ideaId", verifyToken, async (req, res) => {
      const { ideaId } = req.params;
      const result = await commentCollection
        .find({ ideaId: ideaId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    });

    app.post("/comments", verifyToken, async (req, res) => {
      const commentData = req.body;
      commentData.createdAt = new Date();
      const result = await commentCollection.insertOne(commentData);
      res.json(result);
    });

    app.patch("/comments/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { text } = req.body;

      const result = await commentCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { text } }    ,
      );

      res.json(result);
    });

    app.delete("/comments/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await commentCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.get("/interactions/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      const result = await commentCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    });
  } finally {
  }
}

run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});
  
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

