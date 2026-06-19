## Setup

### 1. Clone and create virtual Environment and activate virtual environment
- Go to backend folder 
``` bash
 python3 -m venv venv
 source venv/bin/activate
```

### 2. Install Requirements
``` bash
pip install -r requirements.txt
```

## 3. Start the uvicorn server
``` bash
  uvicorn app.main:app --reload
```
