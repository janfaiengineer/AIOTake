import os
import httpx
import json
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=True)

# Load environment variables
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "my_secret_token")
APP_ID = os.getenv("APP_ID")
APP_SECRET = os.getenv("APP_SECRET")
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v22.0")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development. In production, specify your frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Database: In-memory storage for business accounts
# In a real app, use a proper database (PostgreSQL, MongoDB, etc.)
# Structure: { "waba_id": { "access_token": "...", "phone_number_id": "...", "name": "..." } }
business_accounts: Dict[str, Dict[str, Any]] = {}

class AuthRequest(BaseModel):
    code: str
    redirect_uri: str | None = None

async def exchange_code_for_token(code: str, redirect_uri: str | None = None) -> str:
    """Exchanges the authorization code for an access token."""
    if not APP_ID or not APP_SECRET:
        raise HTTPException(status_code=500, detail="Missing APP_ID or APP_SECRET in environment.")

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/oauth/access_token"
    params = {
        "client_id": APP_ID,
        "client_secret": APP_SECRET,
        "code": code,
    }
    
    if redirect_uri:
        params["redirect_uri"] = redirect_uri

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            error_data = response.json() if response.status_code != 404 else {"error": {"message": response.text}}
            error_msg = error_data.get("error", {}).get("message", "Unknown error from Meta")
            print(f"Token exchange failed: {error_msg}")
            raise HTTPException(status_code=400, detail=f"Failed to exchange code for token: {error_msg}")
        
        data = response.json()
        token = data.get("access_token")
        if not token:
            raise HTTPException(status_code=400, detail="No access token returned from Meta")
        return str(token)
    return ""

async def get_waba_details(access_token: str) -> Dict[str, Any]:
    """Retrieves details for the newly connected WABA."""
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/debug_token"
    params = {
        "input_token": access_token,
        "access_token": f"{APP_ID}|{APP_SECRET}"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json().get("data", {})
            return dict(data) if data else {}
        
        print(f"Debug token failed: {response.text}")
    return {}

async def send_whatsapp_message(phone_number_id: str, access_token: str, to: str, text: str):
    """Sends a text message back to a WhatsApp number."""
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            print(f"Message sent successfully to {to}")
        except httpx.HTTPStatusError as e:
            print(f"Failed to send message: {e.response.text}")

@app.get("/")
async def root():
    return {"message": "WhatsApp Webhook API is running"}

@app.post("/auth/whatsapp")
async def handle_whatsapp_auth(auth_req: AuthRequest):
    """Handles the code from the frontend and exchanges it for a token."""
    print(f"Received auth code: {auth_req.code}")
    
    access_token = await exchange_code_for_token(auth_req.code, auth_req.redirect_uri)
    # Note: In a real flow, you'd get the WABA ID from the frontend or an event listener
    # Here we simulate adding it to our records.
    # For now, we'll use a placeholder if we can't find it immediately.
    
    # Ideally, you'd also start the sync here:
    # POST /<PHONE_ID>/smb_app_data?sync_type=smb_app_state_sync
    # POST /<PHONE_ID>/smb_app_data?sync_type=history
    
    return {"status": "success", "message": "Account connected (token retrieved)"}

@app.get("/webhook")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            return Response(content=challenge, media_type="text/plain")
        else:
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    raise HTTPException(status_code=400, detail="Missing parameters")

@app.post("/webhook")
async def handle_whatsapp_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if body.get("object") == "whatsapp_business_account":
        for entry in body.get("entry", []):
            waba_id = entry.get("id")
            for change in entry.get("changes", []):
                field = change.get("field")
                value = change.get("value", {})
                
                # Handle standard messages
                if field == "messages":
                    if "messages" in value:
                        for message in value["messages"]:
                            from_number = message.get("from")
                            if from_number and from_number.startswith("521") and len(from_number) == 13:
                                from_number = f"52{from_number[3:]}"
                            
                            message_type = message.get("type")
                            print(f"Received {message_type} from {from_number} (WABA: {waba_id})")

                            if message_type == "text":
                                text_body = message.get("text", {}).get("body", "")
                                # Use stored credentials or fallback
                                token = WHATSAPP_TOKEN
                                phone_id = os.getenv("PHONE_NUMBER_ID")
                                
                                if token and phone_id:
                                    await send_whatsapp_message(phone_id, token, from_number, f"Echo: {text_body}")
                                else:
                                    print("Missing credentials for sending message.")
                
                # Handle SMB specific events (Coexistence)
                elif field == "smb_message_echoes":
                    print(f"SMB Message Echo received for WABA {waba_id}")
                    # This event describes messages sent from the WhatsApp Business App
                
                elif field == "smb_app_state_sync":
                    print(f"SMB State Sync update for WABA {waba_id}")
                    # This event describes new/updated contacts

    return {"status": "ok"}
