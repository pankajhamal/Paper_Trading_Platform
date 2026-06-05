# Paper_Trading_Platform
A web based application which provides platform for secondary market with paper money.


Backend Folder Structure
```text
backend/
│
├── app/
│   │
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   │
│   ├── database/
│   │   ├── connection.py
│   │   ├── base.py
│   │   └── session.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── wallet.py
│   │   ├── stock.py
│   │   ├── stock_price.py
│   │   ├── order.py
│   │   ├── portfolio.py
│   │   ├── transaction.py
│   │   ├── watchlist.py
│   │   ├── alert.py
│   │   └── notification.py
│   │
│   ├── schemas/
│   │   ├── user.py
│   │   ├── auth.py
│   │   ├── stock.py
│   │   ├── order.py
│   │   ├── portfolio.py
│   │   ├── transaction.py
│   │   ├── watchlist.py
│   │   ├── alert.py
│   │   └── notification.py
│   │
│   ├── routes/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── stocks.py
│   │   ├── orders.py
│   │   ├── portfolio.py
│   │   ├── wallet.py
│   │   ├── transactions.py
│   │   ├── watchlist.py
│   │   ├── alerts.py
│   │   └── notifications.py
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── stock_service.py
│   │   ├── order_service.py
│   │   ├── portfolio_service.py
│   │   ├── wallet_service.py
│   │   ├── transaction_service.py
│   │   ├── alert_service.py
│   │   ├── notification_service.py
│   │   └── nepse_service.py
│   │
│   ├── utils/
│   │   ├── jwt.py
│   │   ├── hashing.py
│   │   ├── validators.py
│   │   └── helpers.py
│   │
│   ├── middleware/
│   │   └── auth_middleware.py
│   │
│   ├── tasks/
│   │   ├── fetch_stock_prices.py
│   │   └── check_alerts.py
│   │
│   └── constants/
│       └── enums.py
│
├── migrations/
│
├── tests/
│   ├── test_auth.py
│   ├── test_orders.py
│   └── test_stocks.py
│
├── .env
├── requirements.txt
├── alembic.ini
├── README.md
└── run.py
```


## Setup

### 1. Clone and create virtual Environment and activate virtual environment
``` bash
 python3 -m venv venv
 source venv/bin/activate
```

### 2. Install Requirements
``` bash
pip install -r requirements.txt
```

## 3. Start the server