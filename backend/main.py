from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="IPO Prospectus Risk Decoder API",
    description="Backend API serving pre-computed IPO DRHP risk analysis and peer benchmarking metrics.",
    version="1.0.0",
)

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "IPO Prospectus Risk Decoder API",
        "message": "Hello World! Backend initialized successfully.",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "ready",
        "version": "1.0.0",
    }
