-- ENUM types
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'PRO', 'ADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE tx_type AS ENUM ('CHARGE', 'DEDUCT_QUOTE', 'REFUND', 'BONUS');
CREATE TYPE request_status AS ENUM ('OPEN', 'CLOSED', 'CANCELED');
CREATE TYPE room_status AS ENUM ('OPEN', 'MATCHED', 'CLOSED');
CREATE TYPE message_type AS ENUM ('TEXT', 'IMAGE', 'CALL_LOG');

-- Users
CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_provider VARCHAR(50),
    social_id VARCHAR(100),
    role user_role NOT NULL,
    name VARCHAR(100) NOT NULL,
    device_token VARCHAR(255),
    sns_messenger_id VARCHAR(100),
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pro_Profiles
CREATE TABLE Pro_Profiles (
    pro_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES Users(user_id),
    biz_reg_number VARCHAR(50),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    service_region_id INT NOT NULL,
    current_cash DECIMAL NOT NULL DEFAULT 0,
    portfolio_urls JSONB
);
CREATE INDEX idx_pro_region ON Pro_Profiles(service_region_id);

-- Cash_Ledger
CREATE TABLE Cash_Ledger (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pro_id UUID NOT NULL REFERENCES Pro_Profiles(pro_id),
    tx_type tx_type NOT NULL,
    amount DECIMAL NOT NULL,
    balance_snapshot DECIMAL NOT NULL,
    reference_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Match_Requests
CREATE TABLE Match_Requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES Users(user_id),
    category_id INT NOT NULL,
    region_id INT NOT NULL,
    dynamic_answers JSONB NOT NULL,
    status request_status NOT NULL DEFAULT 'OPEN',
    quote_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_req_category ON Match_Requests(category_id);
CREATE INDEX idx_req_region ON Match_Requests(region_id);

-- Match_Quotes
CREATE TABLE Match_Quotes (
    quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES Match_Requests(request_id),
    pro_id UUID NOT NULL REFERENCES Users(user_id),
    cost_deducted DECIMAL NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_matched BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(request_id, pro_id)
);

-- Chat_Rooms
CREATE TABLE Chat_Rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES Match_Requests(request_id),
    customer_id UUID NOT NULL REFERENCES Users(user_id),
    pro_id UUID NOT NULL REFERENCES Users(user_id),
    status room_status NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat_Messages
CREATE TABLE Chat_Messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES Chat_Rooms(room_id),
    sender_id UUID NOT NULL REFERENCES Users(user_id),
    message_type message_type NOT NULL,
    content TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE Reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL UNIQUE REFERENCES Chat_Rooms(room_id),
    pro_id UUID NOT NULL REFERENCES Users(user_id),
    customer_id UUID NOT NULL REFERENCES Users(user_id),
    rating DECIMAL NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
