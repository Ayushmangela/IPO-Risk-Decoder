"""
Vercel Serverless Entrypoint for IPO Prospectus Risk Decoder FastAPI Backend
"""

from backend.main import app

# Export ASGI app instance for Vercel Serverless Functions
app = app
