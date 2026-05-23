import os
import subprocess
import time
import urllib.request
import threading

def run_cmd(cmd, bg=False):
    print(f"Running: {cmd}")
    if bg:
        return subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    else:
        result = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if result.returncode != 0:
            print(f"Command failed with output:\n{result.stdout}")
        return result

def stream_logs(process, prefix):
    try:
        for line in iter(process.stdout.readline, ''):
            if line:
                print(f"[{prefix}] {line.strip()}")
    except Exception as e:
        pass

def main():
    print("--- Starting Colab Backend Setup ---")
    
    # Ensure we are in the correct directory (expecting package.json)
    if not os.path.exists("package.json"):
        print("WARNING: package.json not found! Please run this script from inside the 'backend' folder.")
    
    # 1. Install PostgreSQL
    print("\n--- 1. Setting up PostgreSQL and Dependencies ---")
    run_cmd("sudo apt update && sudo apt install -y postgresql postgresql-contrib zstd")
    run_cmd("sudo service postgresql start")
    
    run_cmd("sudo -u postgres psql -c \"ALTER USER postgres WITH PASSWORD 'root';\"")
    # Drop DB if exists (for re-runs) then create
    run_cmd("sudo -u postgres psql -c \"DROP DATABASE IF EXISTS hr_ai;\"")
    run_cmd("sudo -u postgres psql -c \"CREATE DATABASE hr_ai;\"")
    
    # Import schema if available
    schema_path = "src/db/schema.sql"
    if os.path.exists(schema_path):
        print(f"Importing database schema from {schema_path}...")
        run_cmd(f"sudo -u postgres psql -d hr_ai -f {schema_path}")
    else:
        print("No schema.sql found. Skipping table creation.")
    
    print("PostgreSQL setup complete.")
    
    # 2. Install Ollama
    print("\n--- 2. Setting up Ollama ---")
    run_cmd("curl -fsSL https://ollama.com/install.sh | sh")
    
    print("Starting Ollama service in background...")
    ollama_process = run_cmd("ollama serve", bg=True)
    threading.Thread(target=stream_logs, args=(ollama_process, "OLLAMA"), daemon=True).start()
    
    print("Waiting for Ollama to initialize...")
    time.sleep(5)
    
    # Check .env for model name
    model_name = "gemma:2b" # default
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("MODEL_NAME="):
                    val = line.split("=", 1)[1].strip()
                    if val:
                        model_name = val
                    break
                    
    print(f"Pulling model: {model_name}... (This might take a while)")
    run_cmd(f"ollama pull {model_name}")
    
    # 3. Setup Node.js dependencies
    print("\n--- 3. Installing Node dependencies ---")
    run_cmd("npm install")
    
    # 4. Install Localtunnel
    print("\n--- 4. Installing Localtunnel ---")
    run_cmd("npm install -g localtunnel")
    
    # 5. Start the backend
    print("\n--- 5. Starting Node.js Backend ---")
    node_process = run_cmd("DB_USER=postgres DB_PASSWORD=root DB_HOST=localhost DB_NAME=hr_ai npm start", bg=True)
    threading.Thread(target=stream_logs, args=(node_process, "NODE"), daemon=True).start()
    
    time.sleep(5) # wait for server to start
    
    # 6. Expose port with Localtunnel
    print("\n--- 6. Starting Localtunnel ---")
    try:
        ip = urllib.request.urlopen('https://ipv4.icanhazip.com').read().decode('utf8').strip()
        print("\n==========================================================================")
        print(f" IMPORTANT: Your Localtunnel Endpoint Password / Tunnel IP is: {ip} ")
        print(" When you click the localtunnel link, enter this IP to access the backend.")
        print(" You MUST replace the local API url in your frontend with the Localtunnel URL.")
        print("==========================================================================\n")
    except Exception as e:
        print("Could not fetch IP for Localtunnel password:", e)
        
    lt_process = run_cmd("lt --port 5000", bg=True)
    
    print("\nAll services started! Streaming logs. Press Ctrl+C to stop.")
    try:
        stream_logs(lt_process, "LOCALTUNNEL")
        lt_process.wait()
    except KeyboardInterrupt:
        print("\nStopping all services...")
        node_process.terminate()
        ollama_process.terminate()
        lt_process.terminate()
        run_cmd("sudo service postgresql stop")
        print("Shutdown complete.")

if __name__ == "__main__":
    main()
