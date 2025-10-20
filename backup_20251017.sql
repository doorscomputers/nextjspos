--
-- PostgreSQL database dump
--

\restrict fztTaQ00XdPNyhhhLsmz1Orxb4z9Hu3dpOrWultLDJqkjUPiRGKRo6iz2FgSueA

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _AccountsPayableToPurchaseReturn; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."_AccountsPayableToPurchaseReturn" (
    "A" integer NOT NULL,
    "B" integer NOT NULL
);


ALTER TABLE public."_AccountsPayableToPurchaseReturn" OWNER TO postgres;

--
-- Name: accounts_payable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts_payable (
    id integer NOT NULL,
    business_id integer NOT NULL,
    supplier_id integer NOT NULL,
    purchase_id integer NOT NULL,
    invoice_number character varying(100) NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    paid_amount numeric(22,4) DEFAULT 0 NOT NULL,
    balance_amount numeric(22,4) NOT NULL,
    discount_amount numeric(22,4) DEFAULT 0 NOT NULL,
    payment_status character varying(50) DEFAULT 'unpaid'::character varying NOT NULL,
    payment_terms integer,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.accounts_payable OWNER TO postgres;

--
-- Name: accounts_payable_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accounts_payable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_payable_id_seq OWNER TO postgres;

--
-- Name: accounts_payable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accounts_payable_id_seq OWNED BY public.accounts_payable.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    business_id integer NOT NULL,
    user_id integer NOT NULL,
    username character varying(191) NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_ids text NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    requires_password boolean DEFAULT false NOT NULL,
    password_verified boolean DEFAULT false NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_transactions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    payment_id integer,
    transaction_date date NOT NULL,
    transaction_type character varying(50) NOT NULL,
    amount numeric(22,4) NOT NULL,
    bank_name character varying(191) NOT NULL,
    account_number character varying(100),
    transaction_number character varying(191),
    balance_after numeric(22,4),
    description text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bank_id integer
);


ALTER TABLE public.bank_transactions OWNER TO postgres;

--
-- Name: bank_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bank_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_transactions_id_seq OWNER TO postgres;

--
-- Name: bank_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bank_transactions_id_seq OWNED BY public.bank_transactions.id;


--
-- Name: banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banks (
    id integer NOT NULL,
    business_id integer NOT NULL,
    bank_name character varying(191) NOT NULL,
    account_type character varying(50) NOT NULL,
    account_number character varying(100) NOT NULL,
    opening_balance numeric(22,4) DEFAULT 0 NOT NULL,
    opening_balance_date date,
    current_balance numeric(22,4) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.banks OWNER TO postgres;

--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.banks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.banks_id_seq OWNER TO postgres;

--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.banks_id_seq OWNED BY public.banks.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_id_seq OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: business; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business (
    id integer NOT NULL,
    name text NOT NULL,
    owner_id integer NOT NULL,
    currency_id integer NOT NULL,
    start_date date,
    tax_number_1 character varying(100) NOT NULL,
    tax_label_1 character varying(10) NOT NULL,
    tax_number_2 character varying(100),
    tax_label_2 character varying(10),
    default_profit_percent numeric(5,2) DEFAULT 0 NOT NULL,
    time_zone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    fy_start_month smallint DEFAULT 1 NOT NULL,
    accounting_method text DEFAULT 'fifo'::text NOT NULL,
    default_sales_discount numeric(5,2),
    sell_price_tax text DEFAULT 'includes'::text NOT NULL,
    logo text,
    sku_prefix text DEFAULT 'PROD'::text,
    sku_format text DEFAULT 'hyphen'::text NOT NULL,
    enable_tooltip boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    invoice_scheme character varying(191),
    invoice_layout_for_pos character varying(191),
    invoice_layout_for_sale character varying(191),
    barcode_product_sku boolean DEFAULT true NOT NULL,
    barcode_product_name boolean DEFAULT false NOT NULL,
    barcode_business_name boolean DEFAULT true NOT NULL,
    barcode_product_variation boolean DEFAULT false NOT NULL,
    barcode_product_price boolean DEFAULT true NOT NULL,
    barcode_packing_date boolean DEFAULT false NOT NULL,
    transfer_workflow_mode character varying(20) DEFAULT 'full'::character varying NOT NULL,
    accumulated_sales numeric(22,4) DEFAULT 0 NOT NULL,
    last_z_reading_date timestamp(3) without time zone,
    reset_counter integer DEFAULT 1 NOT NULL,
    z_counter integer DEFAULT 0 NOT NULL,
    invoice_warranty_remarks text
);


ALTER TABLE public.business OWNER TO postgres;

--
-- Name: business_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_id_seq OWNER TO postgres;

--
-- Name: business_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_id_seq OWNED BY public.business.id;


--
-- Name: business_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_locations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(256) NOT NULL,
    landmark text,
    country character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    zip_code character(7) NOT NULL,
    mobile text,
    alternate_number text,
    email text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.business_locations OWNER TO postgres;

--
-- Name: business_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_locations_id_seq OWNER TO postgres;

--
-- Name: business_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_locations_id_seq OWNED BY public.business_locations.id;


--
-- Name: cash_denominations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_denominations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    shift_id integer,
    count_1000 integer DEFAULT 0 NOT NULL,
    count_500 integer DEFAULT 0 NOT NULL,
    count_200 integer DEFAULT 0 NOT NULL,
    count_100 integer DEFAULT 0 NOT NULL,
    count_50 integer DEFAULT 0 NOT NULL,
    count_20 integer DEFAULT 0 NOT NULL,
    count_10 integer DEFAULT 0 NOT NULL,
    count_5 integer DEFAULT 0 NOT NULL,
    count_1 integer DEFAULT 0 NOT NULL,
    count_025 integer DEFAULT 0 NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    count_type character varying(50) NOT NULL,
    notes text,
    counted_by integer NOT NULL,
    counted_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.cash_denominations OWNER TO postgres;

--
-- Name: cash_denominations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_denominations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_denominations_id_seq OWNER TO postgres;

--
-- Name: cash_denominations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_denominations_id_seq OWNED BY public.cash_denominations.id;


--
-- Name: cash_in_out; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_in_out (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    shift_id integer,
    type character varying(20) NOT NULL,
    amount numeric(22,4) NOT NULL,
    reason text NOT NULL,
    reference_number character varying(191),
    requires_approval boolean DEFAULT false NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.cash_in_out OWNER TO postgres;

--
-- Name: cash_in_out_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_in_out_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_in_out_id_seq OWNER TO postgres;

--
-- Name: cash_in_out_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_in_out_id_seq OWNED BY public.cash_in_out.id;


--
-- Name: cashier_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cashier_shifts (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    user_id integer NOT NULL,
    shift_number character varying(100) NOT NULL,
    opened_at timestamp(3) without time zone NOT NULL,
    closed_at timestamp(3) without time zone,
    beginning_cash numeric(22,4) NOT NULL,
    ending_cash numeric(22,4),
    system_cash numeric(22,4),
    cash_over numeric(22,4),
    cash_short numeric(22,4),
    total_sales numeric(22,4) DEFAULT 0 NOT NULL,
    total_refunds numeric(22,4) DEFAULT 0 NOT NULL,
    total_discounts numeric(22,4) DEFAULT 0 NOT NULL,
    total_void numeric(22,4) DEFAULT 0 NOT NULL,
    transaction_count integer DEFAULT 0 NOT NULL,
    x_reading_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    opening_notes text,
    closing_notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.cashier_shifts OWNER TO postgres;

--
-- Name: cashier_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cashier_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cashier_shifts_id_seq OWNER TO postgres;

--
-- Name: cashier_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cashier_shifts_id_seq OWNED BY public.cashier_shifts.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    short_code character varying(191),
    description text,
    parent_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: combo_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.combo_products (
    id integer NOT NULL,
    parent_product_id integer NOT NULL,
    child_product_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.combo_products OWNER TO postgres;

--
-- Name: combo_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.combo_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.combo_products_id_seq OWNER TO postgres;

--
-- Name: combo_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.combo_products_id_seq OWNED BY public.combo_products.id;


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.currencies (
    id integer NOT NULL,
    code character varying(3) NOT NULL,
    name text NOT NULL,
    symbol character varying(10) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.currencies OWNER TO postgres;

--
-- Name: currencies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.currencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.currencies_id_seq OWNER TO postgres;

--
-- Name: currencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.currencies_id_seq OWNED BY public.currencies.id;


--
-- Name: customer_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_return_items (
    id integer NOT NULL,
    customer_return_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_price numeric(22,4) NOT NULL,
    serial_numbers jsonb,
    condition character varying(50) NOT NULL,
    return_type character varying(50) NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_return_items OWNER TO postgres;

--
-- Name: customer_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_return_items_id_seq OWNER TO postgres;

--
-- Name: customer_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_return_items_id_seq OWNED BY public.customer_return_items.id;


--
-- Name: customer_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_returns (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    sale_id integer NOT NULL,
    customer_id integer,
    return_number character varying(100) NOT NULL,
    return_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total_refund_amount numeric(22,4) NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone
);


ALTER TABLE public.customer_returns OWNER TO postgres;

--
-- Name: customer_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_returns_id_seq OWNER TO postgres;

--
-- Name: customer_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_returns_id_seq OWNED BY public.customer_returns.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    email character varying(191),
    mobile character varying(50),
    alternate_number character varying(50),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    zip_code character varying(10),
    tax_number character varying(100),
    credit_limit numeric(22,4),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: debit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.debit_notes (
    id integer NOT NULL,
    business_id integer NOT NULL,
    supplier_id integer NOT NULL,
    purchase_return_id integer NOT NULL,
    debit_note_number character varying(100) NOT NULL,
    debit_note_date date NOT NULL,
    amount numeric(22,4) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.debit_notes OWNER TO postgres;

--
-- Name: debit_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.debit_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.debit_notes_id_seq OWNER TO postgres;

--
-- Name: debit_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.debit_notes_id_seq OWNED BY public.debit_notes.id;


--
-- Name: discount_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discount_configs (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    description text,
    discount_type character varying(50) NOT NULL,
    value numeric(22,4) NOT NULL,
    is_senior_discount boolean DEFAULT false NOT NULL,
    is_pwd_discount boolean DEFAULT false NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    max_amount_without_approval numeric(22,4),
    applicable_to_all boolean DEFAULT true NOT NULL,
    category_ids text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.discount_configs OWNER TO postgres;

--
-- Name: discount_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discount_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.discount_configs_id_seq OWNER TO postgres;

--
-- Name: discount_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discount_configs_id_seq OWNED BY public.discount_configs.id;


--
-- Name: freebie_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.freebie_logs (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    shift_id integer,
    sale_id integer,
    product_id integer NOT NULL,
    variation_id integer NOT NULL,
    quantity numeric(15,4) NOT NULL,
    unit_price numeric(22,4) NOT NULL,
    total_value numeric(22,4) NOT NULL,
    requested_by integer NOT NULL,
    approved_by integer,
    reason text NOT NULL,
    approval_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    ip_address character varying(45),
    device_info character varying(255),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_at timestamp(3) without time zone
);


ALTER TABLE public.freebie_logs OWNER TO postgres;

--
-- Name: freebie_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.freebie_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freebie_logs_id_seq OWNER TO postgres;

--
-- Name: freebie_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.freebie_logs_id_seq OWNED BY public.freebie_logs.id;


--
-- Name: inventory_corrections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_corrections (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    system_count numeric(22,4) NOT NULL,
    physical_count numeric(22,4) NOT NULL,
    difference numeric(22,4) NOT NULL,
    reason character varying(50) NOT NULL,
    remarks text,
    stock_transaction_id integer,
    created_by integer NOT NULL,
    created_by_name character varying(191) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.inventory_corrections OWNER TO postgres;

--
-- Name: inventory_corrections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_corrections_id_seq OWNER TO postgres;

--
-- Name: inventory_corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_corrections_id_seq OWNED BY public.inventory_corrections.id;


--
-- Name: packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.packages (
    id integer NOT NULL,
    name character varying(191) NOT NULL,
    description text NOT NULL,
    location_count integer NOT NULL,
    user_count integer NOT NULL,
    product_count integer NOT NULL,
    invoice_count integer,
    "interval" character varying(191) NOT NULL,
    interval_count integer DEFAULT 1 NOT NULL,
    trial_days integer DEFAULT 0 NOT NULL,
    price numeric(22,4) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    custom_permissions jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.packages OWNER TO postgres;

--
-- Name: packages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packages_id_seq OWNER TO postgres;

--
-- Name: packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    business_id integer NOT NULL,
    supplier_id integer NOT NULL,
    accounts_payable_id integer,
    payment_number character varying(100) NOT NULL,
    payment_date date NOT NULL,
    payment_method character varying(50) NOT NULL,
    amount numeric(22,4) NOT NULL,
    cheque_number character varying(100),
    cheque_date date,
    bank_name character varying(191),
    transaction_reference character varying(191),
    is_post_dated boolean DEFAULT false NOT NULL,
    post_dated_cheque_id integer,
    status character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    notes text,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name text NOT NULL,
    guard_name text DEFAULT 'web'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: post_dated_cheques; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_dated_cheques (
    id integer NOT NULL,
    business_id integer NOT NULL,
    supplier_id integer NOT NULL,
    cheque_number character varying(100) NOT NULL,
    cheque_date date NOT NULL,
    amount numeric(22,4) NOT NULL,
    bank_name character varying(191) NOT NULL,
    account_number character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    reminder_sent boolean DEFAULT false NOT NULL,
    reminder_sent_at timestamp(3) without time zone,
    cleared_date date,
    cleared_by integer,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.post_dated_cheques OWNER TO postgres;

--
-- Name: post_dated_cheques_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_dated_cheques_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_dated_cheques_id_seq OWNER TO postgres;

--
-- Name: post_dated_cheques_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_dated_cheques_id_seq OWNED BY public.post_dated_cheques.id;


--
-- Name: product_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_history (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    transaction_date date NOT NULL,
    reference_type character varying(50) NOT NULL,
    reference_id integer NOT NULL,
    reference_number character varying(100),
    quantity_change numeric(22,4) NOT NULL,
    balance_quantity numeric(22,4) NOT NULL,
    unit_cost numeric(22,4),
    total_value numeric(22,4),
    created_by integer NOT NULL,
    created_by_name character varying(191) NOT NULL,
    reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.product_history OWNER TO postgres;

--
-- Name: product_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_history_id_seq OWNER TO postgres;

--
-- Name: product_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_history_id_seq OWNED BY public.product_history.id;


--
-- Name: product_serial_numbers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_serial_numbers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    "serialNumber" character varying(191) NOT NULL,
    imei character varying(191),
    status character varying(50) DEFAULT 'in_stock'::character varying NOT NULL,
    condition character varying(50) DEFAULT 'new'::character varying NOT NULL,
    current_location_id integer,
    purchase_id integer,
    purchase_receipt_id integer,
    purchased_at timestamp(3) without time zone,
    purchase_cost numeric(22,4),
    sale_id integer,
    sold_at timestamp(3) without time zone,
    sold_to character varying(191),
    warranty_start_date date,
    warranty_end_date date,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    supplier_id integer,
    sale_price numeric(22,4)
);


ALTER TABLE public.product_serial_numbers OWNER TO postgres;

--
-- Name: product_serial_numbers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_serial_numbers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_serial_numbers_id_seq OWNER TO postgres;

--
-- Name: product_serial_numbers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_serial_numbers_id_seq OWNED BY public.product_serial_numbers.id;


--
-- Name: product_variations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variations (
    id integer NOT NULL,
    product_id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    sku character varying(191) NOT NULL,
    purchase_price numeric(22,4) NOT NULL,
    selling_price numeric(22,4) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sub_sku character varying(191),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    unit_id integer,
    supplier_id integer
);


ALTER TABLE public.product_variations OWNER TO postgres;

--
-- Name: product_variations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variations_id_seq OWNER TO postgres;

--
-- Name: product_variations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variations_id_seq OWNED BY public.product_variations.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    type character varying(191) DEFAULT 'single'::character varying NOT NULL,
    category_id integer,
    brand_id integer,
    unit_id integer,
    tax_id integer,
    tax_type character varying(191),
    sku character varying(191) NOT NULL,
    barcode_type character varying(191),
    description text,
    product_description text,
    image text,
    brochure text,
    enable_stock boolean DEFAULT true NOT NULL,
    alert_quantity numeric(22,4),
    purchase_price numeric(22,4),
    selling_price numeric(22,4),
    weight numeric(22,4),
    preparation_time integer,
    enable_product_info boolean DEFAULT false NOT NULL,
    not_for_selling boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    margin_percentage numeric(5,2),
    enable_auto_reorder boolean DEFAULT false NOT NULL,
    lead_time_days integer,
    reorder_point numeric(22,4),
    reorder_quantity numeric(22,4),
    safety_stock_days integer
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_amendments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_amendments (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    business_id integer NOT NULL,
    amendment_number integer NOT NULL,
    amendment_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    amendment_reason character varying(100) NOT NULL,
    previous_data jsonb NOT NULL,
    changed_fields jsonb NOT NULL,
    new_subtotal numeric(22,4),
    new_tax_amount numeric(22,4),
    new_total_amount numeric(22,4),
    description text,
    notes text,
    requested_by integer NOT NULL,
    requested_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    rejected_by integer,
    rejected_at timestamp(3) without time zone,
    rejection_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.purchase_amendments OWNER TO postgres;

--
-- Name: purchase_amendments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_amendments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_amendments_id_seq OWNER TO postgres;

--
-- Name: purchase_amendments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_amendments_id_seq OWNED BY public.purchase_amendments.id;


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_items (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_cost numeric(22,4) NOT NULL,
    quantity_received numeric(22,4) DEFAULT 0 NOT NULL,
    requires_serial boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.purchase_items OWNER TO postgres;

--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_items_id_seq OWNER TO postgres;

--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;


--
-- Name: purchase_receipt_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_receipt_items (
    id integer NOT NULL,
    purchase_receipt_id integer NOT NULL,
    purchase_item_id integer,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity_received numeric(22,4) NOT NULL,
    serial_numbers jsonb,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_receipt_items OWNER TO postgres;

--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNER TO postgres;

--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNED BY public.purchase_receipt_items.id;


--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_receipts (
    id integer NOT NULL,
    business_id integer NOT NULL,
    purchase_id integer,
    location_id integer NOT NULL,
    receipt_number character varying(100) NOT NULL,
    receipt_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    received_by integer NOT NULL,
    received_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    supplier_id integer NOT NULL
);


ALTER TABLE public.purchase_receipts OWNER TO postgres;

--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_receipts_id_seq OWNER TO postgres;

--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_receipts_id_seq OWNED BY public.purchase_receipts.id;


--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_return_items (
    id integer NOT NULL,
    purchase_return_id integer NOT NULL,
    purchase_receipt_item_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity_returned numeric(22,4) NOT NULL,
    unit_cost numeric(22,4) NOT NULL,
    serial_numbers jsonb,
    condition character varying(50) NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_return_items OWNER TO postgres;

--
-- Name: purchase_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_return_items_id_seq OWNER TO postgres;

--
-- Name: purchase_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_return_items_id_seq OWNED BY public.purchase_return_items.id;


--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_returns (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    purchase_receipt_id integer NOT NULL,
    supplier_id integer NOT NULL,
    return_number character varying(100) NOT NULL,
    return_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    return_reason character varying(100) NOT NULL,
    subtotal numeric(22,4) NOT NULL,
    tax_amount numeric(22,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(22,4) DEFAULT 0 NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    expected_action character varying(50) NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    completed_by integer,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.purchase_returns OWNER TO postgres;

--
-- Name: purchase_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_returns_id_seq OWNER TO postgres;

--
-- Name: purchase_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_returns_id_seq OWNED BY public.purchase_returns.id;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    supplier_id integer NOT NULL,
    purchase_order_number character varying(100) NOT NULL,
    purchase_date date NOT NULL,
    expected_delivery_date date,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    subtotal numeric(22,4) NOT NULL,
    tax_amount numeric(22,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(22,4) DEFAULT 0 NOT NULL,
    shipping_cost numeric(22,4) DEFAULT 0 NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    amendment_count integer DEFAULT 0 NOT NULL,
    is_amended boolean DEFAULT false NOT NULL
);


ALTER TABLE public.purchases OWNER TO postgres;

--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchases_id_seq OWNER TO postgres;

--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;


--
-- Name: qc_checklist_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qc_checklist_templates (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    description text,
    category_ids text,
    product_ids text,
    check_items jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.qc_checklist_templates OWNER TO postgres;

--
-- Name: qc_checklist_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.qc_checklist_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.qc_checklist_templates_id_seq OWNER TO postgres;

--
-- Name: qc_checklist_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.qc_checklist_templates_id_seq OWNED BY public.qc_checklist_templates.id;


--
-- Name: quality_control_check_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_control_check_items (
    id integer NOT NULL,
    quality_control_inspection_id integer CONSTRAINT quality_control_check_items_quality_control_inspection_not_null NOT NULL,
    checklist_template_id integer,
    check_name character varying(191) NOT NULL,
    check_category character varying(100) NOT NULL,
    check_result character varying(50) NOT NULL,
    check_value text,
    expected_value text,
    is_critical boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.quality_control_check_items OWNER TO postgres;

--
-- Name: quality_control_check_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quality_control_check_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quality_control_check_items_id_seq OWNER TO postgres;

--
-- Name: quality_control_check_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quality_control_check_items_id_seq OWNED BY public.quality_control_check_items.id;


--
-- Name: quality_control_inspections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_control_inspections (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    purchase_receipt_id integer NOT NULL,
    inspection_number character varying(100) NOT NULL,
    inspection_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    overall_result character varying(50),
    inspected_by integer NOT NULL,
    inspected_at timestamp(3) without time zone,
    inspector_notes text,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    approval_notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.quality_control_inspections OWNER TO postgres;

--
-- Name: quality_control_inspections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quality_control_inspections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quality_control_inspections_id_seq OWNER TO postgres;

--
-- Name: quality_control_inspections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quality_control_inspections_id_seq OWNED BY public.quality_control_inspections.id;


--
-- Name: quality_control_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_control_items (
    id integer NOT NULL,
    quality_control_inspection_id integer NOT NULL,
    purchase_receipt_item_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity_ordered numeric(22,4) NOT NULL,
    quantity_received numeric(22,4) NOT NULL,
    quantity_inspected numeric(22,4) NOT NULL,
    quantity_passed numeric(22,4) NOT NULL,
    quantity_failed numeric(22,4) NOT NULL,
    inspection_result character varying(50) NOT NULL,
    defect_type character varying(100),
    defect_description text,
    defect_severity character varying(50),
    action_taken character varying(100),
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.quality_control_items OWNER TO postgres;

--
-- Name: quality_control_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quality_control_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quality_control_items_id_seq OWNER TO postgres;

--
-- Name: quality_control_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quality_control_items_id_seq OWNED BY public.quality_control_items.id;


--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_items (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_price numeric(22,4) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.quotation_items OWNER TO postgres;

--
-- Name: quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_items_id_seq OWNER TO postgres;

--
-- Name: quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotation_items_id_seq OWNED BY public.quotation_items.id;


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    customer_id integer,
    quotation_number character varying(100) NOT NULL,
    quotation_date date NOT NULL,
    expiry_date date,
    valid_days integer DEFAULT 7 NOT NULL,
    subtotal numeric(22,4) NOT NULL,
    tax_amount numeric(22,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(22,4) DEFAULT 0 NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    converted_to_sale_id integer,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    customer_name character varying(191)
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotations_id_seq OWNER TO postgres;

--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotations_id_seq OWNED BY public.quotations.id;


--
-- Name: role_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_locations (
    role_id integer NOT NULL,
    location_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.role_locations OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    guard_name text DEFAULT 'web'::text NOT NULL,
    business_id integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_items (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_price numeric(22,4) NOT NULL,
    unit_cost numeric(22,4) NOT NULL,
    serial_numbers jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sale_items OWNER TO postgres;

--
-- Name: sale_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sale_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_items_id_seq OWNER TO postgres;

--
-- Name: sale_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sale_items_id_seq OWNED BY public.sale_items.id;


--
-- Name: sale_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_payments (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    payment_method character varying(50) NOT NULL,
    amount numeric(22,4) NOT NULL,
    reference_number character varying(191),
    paid_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sale_payments OWNER TO postgres;

--
-- Name: sale_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sale_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_payments_id_seq OWNER TO postgres;

--
-- Name: sale_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sale_payments_id_seq OWNED BY public.sale_payments.id;


--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    customer_id integer,
    invoice_number character varying(100) NOT NULL,
    sale_date date NOT NULL,
    status character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    subtotal numeric(22,4) NOT NULL,
    tax_amount numeric(22,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(22,4) DEFAULT 0 NOT NULL,
    shipping_cost numeric(22,4) DEFAULT 0 NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    discount_approved_by integer,
    discount_type character varying(50),
    pwd_id character varying(100),
    pwd_name character varying(191),
    senior_citizen_id character varying(100),
    senior_citizen_name character varying(191),
    shift_id integer,
    vat_exempt boolean DEFAULT false NOT NULL,
    warranty_terms text
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_id_seq OWNER TO postgres;

--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- Name: serial_number_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.serial_number_movements (
    id integer NOT NULL,
    serial_number_id integer NOT NULL,
    "movementType" character varying(50) NOT NULL,
    from_location_id integer,
    to_location_id integer,
    "referenceType" character varying(50),
    reference_id integer,
    notes text,
    moved_by integer NOT NULL,
    moved_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.serial_number_movements OWNER TO postgres;

--
-- Name: serial_number_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.serial_number_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.serial_number_movements_id_seq OWNER TO postgres;

--
-- Name: serial_number_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.serial_number_movements_id_seq OWNED BY public.serial_number_movements.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    session_token text NOT NULL,
    user_id integer NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: stock_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_transactions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    location_id integer NOT NULL,
    type character varying(50) NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_cost numeric(22,4),
    balance_qty numeric(22,4) NOT NULL,
    reference_type character varying(50),
    reference_id integer,
    created_by integer NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stock_transactions OWNER TO postgres;

--
-- Name: stock_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_transactions_id_seq OWNER TO postgres;

--
-- Name: stock_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_transactions_id_seq OWNED BY public.stock_transactions.id;


--
-- Name: stock_transfer_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_transfer_items (
    id integer NOT NULL,
    stock_transfer_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    serial_numbers_sent jsonb,
    serial_numbers_received jsonb,
    received_quantity numeric(22,4),
    verified boolean DEFAULT false NOT NULL,
    verified_by integer,
    verified_at timestamp(3) without time zone,
    has_discrepancy boolean DEFAULT false NOT NULL,
    discrepancy_notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.stock_transfer_items OWNER TO postgres;

--
-- Name: stock_transfer_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_transfer_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_transfer_items_id_seq OWNER TO postgres;

--
-- Name: stock_transfer_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_transfer_items_id_seq OWNED BY public.stock_transfer_items.id;


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_transfers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    transfer_number character varying(100) NOT NULL,
    from_location_id integer NOT NULL,
    to_location_id integer NOT NULL,
    transfer_date date NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    stock_deducted boolean DEFAULT false NOT NULL,
    notes text,
    created_by integer NOT NULL,
    checked_by integer,
    checked_at timestamp(3) without time zone,
    checker_notes text,
    sent_by integer,
    sent_at timestamp(3) without time zone,
    arrived_by integer,
    arrived_at timestamp(3) without time zone,
    verified_by integer,
    verified_at timestamp(3) without time zone,
    verifier_notes text,
    completed_by integer,
    completed_at timestamp(3) without time zone,
    received_by integer,
    received_at timestamp(3) without time zone,
    cancelled_by integer,
    cancelled_at timestamp(3) without time zone,
    cancellation_reason text,
    has_discrepancy boolean DEFAULT false NOT NULL,
    discrepancy_notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.stock_transfers OWNER TO postgres;

--
-- Name: stock_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_transfers_id_seq OWNER TO postgres;

--
-- Name: stock_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_transfers_id_seq OWNED BY public.stock_transfers.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    package_id integer NOT NULL,
    start_date date NOT NULL,
    trial_end_date date,
    end_date date,
    package_price numeric(22,4) NOT NULL,
    package_details jsonb,
    paid_via character varying(191),
    payment_transaction_id character varying(191),
    status character varying(191) DEFAULT 'approved'::character varying NOT NULL,
    created_by integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: supplier_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_return_items (
    id integer NOT NULL,
    supplier_return_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    quantity numeric(22,4) NOT NULL,
    unit_cost numeric(22,4) NOT NULL,
    serial_numbers jsonb,
    condition character varying(50) NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_return_items OWNER TO postgres;

--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_return_items_id_seq OWNER TO postgres;

--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_return_items_id_seq OWNED BY public.supplier_return_items.id;


--
-- Name: supplier_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_returns (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    supplier_id integer NOT NULL,
    return_number character varying(100) NOT NULL,
    return_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    return_reason character varying(100) NOT NULL,
    total_amount numeric(22,4) NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone
);


ALTER TABLE public.supplier_returns OWNER TO postgres;

--
-- Name: supplier_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supplier_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_returns_id_seq OWNER TO postgres;

--
-- Name: supplier_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supplier_returns_id_seq OWNED BY public.supplier_returns.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    contact_person character varying(191),
    email character varying(191),
    mobile character varying(50),
    alternate_number character varying(50),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    zip_code character varying(10),
    tax_number character varying(100),
    payment_terms integer,
    credit_limit numeric(22,4),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_rates (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    amount numeric(5,2) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.tax_rates OWNER TO postgres;

--
-- Name: tax_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_rates_id_seq OWNER TO postgres;

--
-- Name: tax_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_rates_id_seq OWNED BY public.tax_rates.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    short_name character varying(191) NOT NULL,
    allow_decimal boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: user_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_locations (
    user_id integer NOT NULL,
    location_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_locations OWNER TO postgres;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    user_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    surname text NOT NULL,
    first_name text NOT NULL,
    last_name text,
    username text NOT NULL,
    email text,
    password text NOT NULL,
    language character(7) DEFAULT 'en'::bpchar NOT NULL,
    business_id integer,
    contact_number text,
    alt_number text,
    family_number text,
    allow_login boolean DEFAULT true NOT NULL,
    user_type text DEFAULT 'user'::text NOT NULL,
    selected_contacts boolean DEFAULT false NOT NULL,
    max_sale_discount numeric(5,2),
    theme text DEFAULT 'light'::text,
    theme_mode text DEFAULT 'light'::text,
    sidebar_style text DEFAULT 'default'::text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: variation_location_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variation_location_details (
    id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    location_id integer NOT NULL,
    qty_available numeric(22,4) DEFAULT 0 NOT NULL,
    selling_price numeric(22,4),
    opening_stock_locked boolean DEFAULT false NOT NULL,
    opening_stock_set_at timestamp(3) without time zone,
    opening_stock_set_by integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.variation_location_details OWNER TO postgres;

--
-- Name: variation_location_details_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.variation_location_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.variation_location_details_id_seq OWNER TO postgres;

--
-- Name: variation_location_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.variation_location_details_id_seq OWNED BY public.variation_location_details.id;


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- Name: void_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.void_transactions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    sale_id integer NOT NULL,
    void_reason text NOT NULL,
    original_amount numeric(22,4) NOT NULL,
    voided_by integer NOT NULL,
    approved_by integer,
    approved_at timestamp(3) without time zone,
    requires_manager_approval boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.void_transactions OWNER TO postgres;

--
-- Name: void_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.void_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.void_transactions_id_seq OWNER TO postgres;

--
-- Name: void_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.void_transactions_id_seq OWNED BY public.void_transactions.id;


--
-- Name: warranties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warranties (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(191) NOT NULL,
    description text,
    duration integer NOT NULL,
    duration_type character varying(50) DEFAULT 'months'::character varying NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.warranties OWNER TO postgres;

--
-- Name: warranties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranties_id_seq OWNER TO postgres;

--
-- Name: warranties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranties_id_seq OWNED BY public.warranties.id;


--
-- Name: warranty_claims; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warranty_claims (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    product_variation_id integer NOT NULL,
    serial_number character varying(191),
    claim_number character varying(100) NOT NULL,
    claim_date date NOT NULL,
    issue_description text NOT NULL,
    claim_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    replacement_type character varying(50),
    replaced_with_serial_number character varying(191),
    is_user_negligence boolean DEFAULT false NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp(3) without time zone
);


ALTER TABLE public.warranty_claims OWNER TO postgres;

--
-- Name: warranty_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_claims_id_seq OWNER TO postgres;

--
-- Name: warranty_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_claims_id_seq OWNED BY public.warranty_claims.id;


--
-- Name: accounts_payable id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts_payable ALTER COLUMN id SET DEFAULT nextval('public.accounts_payable_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: bank_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions ALTER COLUMN id SET DEFAULT nextval('public.bank_transactions_id_seq'::regclass);


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks ALTER COLUMN id SET DEFAULT nextval('public.banks_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: business id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business ALTER COLUMN id SET DEFAULT nextval('public.business_id_seq'::regclass);


--
-- Name: business_locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_locations ALTER COLUMN id SET DEFAULT nextval('public.business_locations_id_seq'::regclass);


--
-- Name: cash_denominations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_denominations ALTER COLUMN id SET DEFAULT nextval('public.cash_denominations_id_seq'::regclass);


--
-- Name: cash_in_out id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_in_out ALTER COLUMN id SET DEFAULT nextval('public.cash_in_out_id_seq'::regclass);


--
-- Name: cashier_shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cashier_shifts ALTER COLUMN id SET DEFAULT nextval('public.cashier_shifts_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: combo_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.combo_products ALTER COLUMN id SET DEFAULT nextval('public.combo_products_id_seq'::regclass);


--
-- Name: currencies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies ALTER COLUMN id SET DEFAULT nextval('public.currencies_id_seq'::regclass);


--
-- Name: customer_return_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_return_items ALTER COLUMN id SET DEFAULT nextval('public.customer_return_items_id_seq'::regclass);


--
-- Name: customer_returns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_returns ALTER COLUMN id SET DEFAULT nextval('public.customer_returns_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: debit_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debit_notes ALTER COLUMN id SET DEFAULT nextval('public.debit_notes_id_seq'::regclass);


--
-- Name: discount_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discount_configs ALTER COLUMN id SET DEFAULT nextval('public.discount_configs_id_seq'::regclass);


--
-- Name: freebie_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs ALTER COLUMN id SET DEFAULT nextval('public.freebie_logs_id_seq'::regclass);


--
-- Name: inventory_corrections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections ALTER COLUMN id SET DEFAULT nextval('public.inventory_corrections_id_seq'::regclass);


--
-- Name: packages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: post_dated_cheques id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_dated_cheques ALTER COLUMN id SET DEFAULT nextval('public.post_dated_cheques_id_seq'::regclass);


--
-- Name: product_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_history ALTER COLUMN id SET DEFAULT nextval('public.product_history_id_seq'::regclass);


--
-- Name: product_serial_numbers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers ALTER COLUMN id SET DEFAULT nextval('public.product_serial_numbers_id_seq'::regclass);


--
-- Name: product_variations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations ALTER COLUMN id SET DEFAULT nextval('public.product_variations_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_amendments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_amendments ALTER COLUMN id SET DEFAULT nextval('public.purchase_amendments_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);


--
-- Name: purchase_receipt_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipt_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipt_items_id_seq'::regclass);


--
-- Name: purchase_receipts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipts ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipts_id_seq'::regclass);


--
-- Name: purchase_return_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_return_items_id_seq'::regclass);


--
-- Name: purchase_returns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns ALTER COLUMN id SET DEFAULT nextval('public.purchase_returns_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);


--
-- Name: qc_checklist_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_checklist_templates ALTER COLUMN id SET DEFAULT nextval('public.qc_checklist_templates_id_seq'::regclass);


--
-- Name: quality_control_check_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_check_items ALTER COLUMN id SET DEFAULT nextval('public.quality_control_check_items_id_seq'::regclass);


--
-- Name: quality_control_inspections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_inspections ALTER COLUMN id SET DEFAULT nextval('public.quality_control_inspections_id_seq'::regclass);


--
-- Name: quality_control_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_items ALTER COLUMN id SET DEFAULT nextval('public.quality_control_items_id_seq'::regclass);


--
-- Name: quotation_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items ALTER COLUMN id SET DEFAULT nextval('public.quotation_items_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations ALTER COLUMN id SET DEFAULT nextval('public.quotations_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: sale_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items ALTER COLUMN id SET DEFAULT nextval('public.sale_items_id_seq'::regclass);


--
-- Name: sale_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments ALTER COLUMN id SET DEFAULT nextval('public.sale_payments_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- Name: serial_number_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.serial_number_movements ALTER COLUMN id SET DEFAULT nextval('public.serial_number_movements_id_seq'::regclass);


--
-- Name: stock_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transactions ALTER COLUMN id SET DEFAULT nextval('public.stock_transactions_id_seq'::regclass);


--
-- Name: stock_transfer_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfer_items ALTER COLUMN id SET DEFAULT nextval('public.stock_transfer_items_id_seq'::regclass);


--
-- Name: stock_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers ALTER COLUMN id SET DEFAULT nextval('public.stock_transfers_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: supplier_return_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_items_id_seq'::regclass);


--
-- Name: supplier_returns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns ALTER COLUMN id SET DEFAULT nextval('public.supplier_returns_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: tax_rates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_rates ALTER COLUMN id SET DEFAULT nextval('public.tax_rates_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: variation_location_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variation_location_details ALTER COLUMN id SET DEFAULT nextval('public.variation_location_details_id_seq'::regclass);


--
-- Name: void_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_transactions ALTER COLUMN id SET DEFAULT nextval('public.void_transactions_id_seq'::regclass);


--
-- Name: warranties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranties ALTER COLUMN id SET DEFAULT nextval('public.warranties_id_seq'::regclass);


--
-- Name: warranty_claims id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_claims ALTER COLUMN id SET DEFAULT nextval('public.warranty_claims_id_seq'::regclass);


--
-- Data for Name: _AccountsPayableToPurchaseReturn; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."_AccountsPayableToPurchaseReturn" ("A", "B") FROM stdin;
\.


--
-- Data for Name: accounts_payable; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts_payable (id, business_id, supplier_id, purchase_id, invoice_number, invoice_date, due_date, total_amount, paid_amount, balance_amount, discount_amount, payment_status, payment_terms, notes, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, business_id, user_id, username, action, entity_type, entity_ids, description, metadata, requires_password, password_verified, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: bank_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_transactions (id, business_id, payment_id, transaction_date, transaction_type, amount, bank_name, account_number, transaction_number, balance_after, description, created_by, created_at, bank_id) FROM stdin;
\.


--
-- Data for Name: banks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.banks (id, business_id, bank_name, account_type, account_number, opening_balance, opening_balance_date, current_balance, is_active, notes, created_by, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, business_id, name, description, created_at, updated_at, deleted_at) FROM stdin;
1	1	Dell	Dell Inc. - American technology company	2025-10-07 23:39:42.148	2025-10-07 23:39:42.148	\N
2	1	HP	Hewlett-Packard - Leading PC manufacturer	2025-10-07 23:39:42.151	2025-10-07 23:39:42.151	\N
3	1	Logitech	Swiss provider of personal computer and mobile peripherals	2025-10-07 23:39:42.153	2025-10-07 23:39:42.153	\N
4	1	MSI		2025-10-08 01:26:04.352	2025-10-08 01:26:04.352	\N
5	1	Generic		2025-10-08 03:05:45.676	2025-10-08 03:05:45.676	\N
6	1	Generic		2025-10-11 02:29:28.937	2025-10-11 02:29:28.937	\N
7	1	Samsung		2025-10-11 02:31:41.257	2025-10-11 02:31:41.257	\N
8	1	Western Digital		2025-10-11 04:44:09.574	2025-10-11 04:44:09.574	\N
\.


--
-- Data for Name: business; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business (id, name, owner_id, currency_id, start_date, tax_number_1, tax_label_1, tax_number_2, tax_label_2, default_profit_percent, time_zone, fy_start_month, accounting_method, default_sales_discount, sell_price_tax, logo, sku_prefix, sku_format, enable_tooltip, created_at, updated_at, invoice_scheme, invoice_layout_for_pos, invoice_layout_for_sale, barcode_product_sku, barcode_product_name, barcode_business_name, barcode_product_variation, barcode_product_price, barcode_packing_date, transfer_workflow_mode, accumulated_sales, last_z_reading_date, reset_counter, z_counter, invoice_warranty_remarks) FROM stdin;
1	PciNet Computer Trading and Services	1	1	2025-01-01	TAX-001-123	VAT			15.00	Asia/Manila	1	fifo	\N	includes	\N	PCI	hyphen	t	2025-10-07 23:39:41.691	2025-10-08 22:20:58.863	\N	\N	\N	t	f	t	f	t	f	full	0.0000	\N	1	0	\N
\.


--
-- Data for Name: business_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_locations (id, business_id, name, landmark, country, state, city, zip_code, mobile, alternate_number, email, created_at, updated_at, deleted_at) FROM stdin;
1	1	Main Store		Philippines	Region 2	Solano	3500   	+63-912-555-0001		main@pcinetstore.com	2025-10-07 23:39:41.696	2025-10-08 05:43:49.288	\N
3	1	Bambang		Philippines	Region 2	Bambang	3702   	+63-912-555-0003		bambang@pcinetstore.com	2025-10-07 23:39:41.7	2025-10-08 05:44:15.171	\N
6	1	Baguio		Philippines	CAR	Baguio	2600   				2025-10-08 05:42:55.922	2025-10-08 05:44:22.995	\N
5	1	Santiago		Philippines	Region 2	Santiago	1234   				2025-10-08 05:42:31.389	2025-10-08 05:44:28.935	\N
4	1	Tuguegarao		Philippines	Region 2	Tuguegarao	3500   	+63-912-555-0004		downtown@pcinetstore.com	2025-10-07 23:39:41.701	2025-10-08 05:44:38.566	\N
101	1	Branch Makati	\N	Philippines	Metro Manila	Makati	1200   	+639171234502	\N	branch.makati@test.com	2025-10-11 15:43:58.427	2025-10-11 15:43:58.427	\N
102	1	Branch Pasig	\N	Philippines	Metro Manila	Pasig	1600   	+639171234503	\N	branch.pasig@test.com	2025-10-11 15:43:58.437	2025-10-11 15:43:58.437	\N
103	1	Branch Cebu	\N	Philippines	Cebu	Cebu City	6000   	+639171234504	\N	branch.cebu@test.com	2025-10-11 15:43:58.448	2025-10-11 15:43:58.448	\N
100	1	Future Location 2	\N	Philippines	Metro Manila	Quezon City	1100   	+639171234501	\N	warehouse.main@test.com	2025-10-11 15:43:58.405	2025-10-11 15:43:58.405	\N
2	1	Main Warehouse		Philippines	Region 2	Solano	3500   	+63-912-555-0002		warehouse@pcinetstore.com	2025-10-07 23:39:41.699	2025-10-12 02:10:55.322	\N
\.


--
-- Data for Name: cash_denominations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_denominations (id, business_id, location_id, shift_id, count_1000, count_500, count_200, count_100, count_50, count_20, count_10, count_5, count_1, count_025, total_amount, count_type, notes, counted_by, counted_at) FROM stdin;
\.


--
-- Data for Name: cash_in_out; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_in_out (id, business_id, location_id, shift_id, type, amount, reason, reference_number, requires_approval, approved_by, approved_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: cashier_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cashier_shifts (id, business_id, location_id, user_id, shift_number, opened_at, closed_at, beginning_cash, ending_cash, system_cash, cash_over, cash_short, total_sales, total_refunds, total_discounts, total_void, transaction_count, x_reading_count, status, opening_notes, closing_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, business_id, name, short_code, description, parent_id, created_at, updated_at, deleted_at) FROM stdin;
7	1	Others 2			6	2025-10-08 02:23:02.137	2025-10-08 02:24:09.193	\N
9	1	SSD Storage			\N	2025-10-11 02:31:26.517	2025-10-11 02:31:26.517	\N
3	1	Sample1	ACC	Computer accessories and peripherals	\N	2025-10-07 23:39:42.147	2025-10-14 18:38:53.922	\N
1	1	Sample2	ELEC	Electronic devices and accessories	\N	2025-10-07 23:39:42.143	2025-10-14 18:39:00.2	\N
5	1	Sample3			1	2025-10-08 02:18:37.76	2025-10-14 18:39:06.03	\N
6	1	Sample4			\N	2025-10-08 02:22:47.523	2025-10-14 18:39:12.272	\N
2	1	Sample5	COMP	Desktop and laptop computers	\N	2025-10-07 23:39:42.146	2025-10-14 18:39:27.152	\N
8	1	Sample6			\N	2025-10-08 03:05:26.401	2025-10-14 18:39:33.877	\N
4	1	Sample7			\N	2025-10-08 01:25:45.295	2025-10-14 18:39:41.373	\N
\.


--
-- Data for Name: combo_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.combo_products (id, parent_product_id, child_product_id, quantity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.currencies (id, code, name, symbol, created_at, updated_at) FROM stdin;
1	USD	US Dollar	$	2025-10-07 23:39:41.616	2025-10-07 23:39:41.616
\.


--
-- Data for Name: customer_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_return_items (id, customer_return_id, product_id, product_variation_id, quantity, unit_price, serial_numbers, condition, return_type, notes, created_at) FROM stdin;
\.


--
-- Data for Name: customer_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_returns (id, business_id, location_id, sale_id, customer_id, return_number, return_date, status, total_refund_amount, notes, created_by, created_at, approved_by, approved_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, business_id, name, email, mobile, alternate_number, address, city, state, country, zip_code, tax_number, credit_limit, is_active, created_at, updated_at, deleted_at) FROM stdin;
1	1	Juan de la Cruz	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-13 09:23:22.173	2025-10-13 09:23:22.173	\N
2	1	Juan de la Cruz	\N	\N	\N	ACD 123 St. Solano Nueva Vizcaya	\N	\N	\N	\N	\N	\N	t	2025-10-13 09:51:04.865	2025-10-13 11:32:19.064	2025-10-13 11:32:19.061
3	1	Pedro 	\N	\N	\N	Lagawe	\N	\N	\N	\N	\N	\N	t	2025-10-13 12:26:34.828	2025-10-13 12:26:34.828	\N
\.


--
-- Data for Name: debit_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.debit_notes (id, business_id, supplier_id, purchase_return_id, debit_note_number, debit_note_date, amount, status, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: discount_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discount_configs (id, business_id, name, description, discount_type, value, is_senior_discount, is_pwd_discount, requires_approval, max_amount_without_approval, applicable_to_all, category_ids, is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: freebie_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.freebie_logs (id, business_id, location_id, shift_id, sale_id, product_id, variation_id, quantity, unit_price, total_value, requested_by, approved_by, reason, approval_status, ip_address, device_info, created_at, approved_at) FROM stdin;
\.


--
-- Data for Name: inventory_corrections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_corrections (id, business_id, location_id, product_id, product_variation_id, system_count, physical_count, difference, reason, remarks, stock_transaction_id, created_by, created_by_name, status, approved_by, approved_at, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.packages (id, name, description, location_count, user_count, product_count, invoice_count, "interval", interval_count, trial_days, price, sort_order, is_active, is_private, custom_permissions, created_at, updated_at) FROM stdin;
1	Free Trial	Perfect for testing the system	1	3	50	100	days	1	30	0.0000	1	t	f	{"modules": ["pos", "products", "customers"], "features": ["basic_reporting"]}	2025-10-07 23:39:42.127	2025-10-07 23:39:42.127
2	Basic	For small businesses getting started	1	5	500	1000	months	1	14	29.9900	2	t	f	{"modules": ["pos", "products", "customers", "suppliers", "expenses"], "features": ["basic_reporting", "inventory_management"]}	2025-10-07 23:39:42.132	2025-10-07 23:39:42.132
3	Professional	For growing businesses with multiple locations	5	25	5000	\N	months	1	14	99.9900	3	t	f	{"modules": ["pos", "products", "customers", "suppliers", "expenses", "purchases", "stock_transfers"], "features": ["advanced_reporting", "inventory_management", "multi_location", "user_management"]}	2025-10-07 23:39:42.133	2025-10-07 23:39:42.133
4	Enterprise	For large businesses with unlimited needs	999	999	999999	\N	months	1	30	299.9900	4	t	f	{"modules": ["all"], "features": ["all"]}	2025-10-07 23:39:42.134	2025-10-07 23:39:42.134
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, business_id, supplier_id, accounts_payable_id, payment_number, payment_date, payment_method, amount, cheque_number, cheque_date, bank_name, transaction_reference, is_post_dated, post_dated_cheque_id, status, notes, approved_by, approved_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, name, guard_name, created_at, updated_at) FROM stdin;
1	dashboard.view	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
2	physical_inventory.export	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
3	inventory_correction.delete	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
4	sell.view	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
5	sell.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
6	physical_inventory.import	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
7	sell.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
8	purchase.receipt.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
9	purchase.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
10	purchase.receipt.approve	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
11	purchase.receipt.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
12	purchase.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
13	purchase.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
14	stock_transfer.send	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
15	stock_transfer.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
16	purchase.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
17	stock_transfer.check	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
18	customer_return.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
19	stock_transfer.verify	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
20	sell.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
21	customer_return.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
22	stock_transfer.cancel	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
23	inventory_correction.approve	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
24	sell.view_own	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
25	customer_return.approve	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
26	supplier_return.approve	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
27	user.view	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
28	supplier_return.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
29	user.create	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
30	serial_number.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
31	customer_return.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
32	serial_number.track	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
33	product.modify_locked_stock	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
34	stock_transfer.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
35	supplier_return.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
36	expense.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
37	stock_transfer.receive	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
38	user.update	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
39	expense.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
40	expense.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
41	customer.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
42	customer.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
43	customer.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
44	stock_transfer.complete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
45	customer.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
46	supplier_return.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
47	supplier.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
48	supplier.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
49	expense.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
50	inventory_correction.update	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
51	report.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
52	report.purchase_sell	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
54	supplier.create	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
53	role.create	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
55	report.profit_loss	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
56	business_settings.edit	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
57	serial_number.scan	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
58	report.stock.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
59	business_settings.view	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
60	supplier.delete	web	2025-10-07 23:39:41.707	2025-10-07 23:39:41.707
61	location.create	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
62	location.view	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
63	location.delete	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
64	location.update	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
65	access_all_locations	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
66	superadmin.business.view	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
67	superadmin.all	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
68	superadmin.business.create	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
69	superadmin.package.view	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
70	superadmin.package.create	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
71	superadmin.business.delete	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
72	superadmin.business.update	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
73	superadmin.package.update	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
74	superadmin.package.delete	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
75	superadmin.subscription.view	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
76	superadmin.subscription.create	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
77	superadmin.subscription.update	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
78	superadmin.subscription.delete	web	2025-10-07 23:39:41.708	2025-10-07 23:39:41.708
79	role.delete	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
80	role.view	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
81	user.delete	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
82	product.view_all_branch_stock	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
83	product.view_purchase_price	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
84	role.update	web	2025-10-07 23:39:41.705	2025-10-07 23:39:41.705
85	product.view	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
86	inventory_correction.create	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
87	product.create	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
88	product.opening_stock	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
89	product.lock_opening_stock	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
90	product.unlock_opening_stock	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
91	product.update	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
92	inventory_correction.view	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
93	product.delete	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
94	product.access_default_selling_price	web	2025-10-07 23:39:41.706	2025-10-07 23:39:41.706
95	purchase.approve	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
96	purchase.receive	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
97	accounts_payable.view	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
98	accounts_payable.create	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
99	accounts_payable.update	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
100	payment.view	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
101	payment.create	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
102	payment.update	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
103	payment.delete	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
104	accounts_payable.delete	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
105	payment.approve	web	2025-10-09 01:50:26.521	2025-10-09 01:50:26.521
106	purchase.view_cost	web	2025-10-09 03:31:24.913	2025-10-09 03:31:24.913
108	qc_inspection.view	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
109	qc_inspection.create	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
110	qc_inspection.conduct	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
111	qc_inspection.approve	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
112	qc_template.view	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
113	qc_template.manage	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
114	purchase_amendment.view	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
115	purchase_amendment.create	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
116	purchase_amendment.approve	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
117	purchase_amendment.reject	web	2025-10-11 15:12:12.09	2025-10-11 15:12:12.09
118	purchase_return.view	web	2025-10-11 10:40:20.533	2025-10-11 10:40:20.533
119	purchase_return.create	web	2025-10-11 10:40:20.569	2025-10-11 10:40:20.569
120	purchase_return.update	web	2025-10-11 10:40:20.577	2025-10-11 10:40:20.577
121	purchase_return.delete	web	2025-10-11 10:40:20.584	2025-10-11 10:40:20.584
122	purchase_return.approve	web	2025-10-11 10:40:20.592	2025-10-11 10:40:20.592
123	shift.open	web	2025-10-12 23:47:40.644	2025-10-12 23:47:40.644
124	shift.close	web	2025-10-12 23:47:40.65	2025-10-12 23:47:40.65
125	shift.view	web	2025-10-12 23:47:40.652	2025-10-12 23:47:40.652
126	shift.view_all	web	2025-10-12 23:47:40.653	2025-10-12 23:47:40.653
127	cash.in_out	web	2025-10-12 23:47:40.655	2025-10-12 23:47:40.655
128	cash.count	web	2025-10-12 23:47:40.656	2025-10-12 23:47:40.656
129	cash.approve_large_transactions	web	2025-10-12 23:47:40.657	2025-10-12 23:47:40.657
130	void.create	web	2025-10-12 23:47:40.658	2025-10-12 23:47:40.658
131	void.approve	web	2025-10-12 23:47:40.659	2025-10-12 23:47:40.659
132	reading.x_reading	web	2025-10-12 23:47:40.66	2025-10-12 23:47:40.66
133	reading.z_reading	web	2025-10-12 23:47:40.662	2025-10-12 23:47:40.662
134	sales_report.view	web	2025-10-12 23:47:40.662	2025-10-12 23:47:40.662
135	sales_report.daily	web	2025-10-12 23:47:40.663	2025-10-12 23:47:40.663
136	sales_report.summary	web	2025-10-12 23:47:40.664	2025-10-12 23:47:40.664
137	product.category.view	web	2025-10-13 01:00:10.803	2025-10-13 01:00:10.803
138	product.category.create	web	2025-10-13 01:00:10.827	2025-10-13 01:00:10.827
139	product.category.update	web	2025-10-13 01:00:10.829	2025-10-13 01:00:10.829
140	product.category.delete	web	2025-10-13 01:00:10.83	2025-10-13 01:00:10.83
141	product.brand.view	web	2025-10-13 01:00:10.832	2025-10-13 01:00:10.832
142	product.brand.create	web	2025-10-13 01:00:10.835	2025-10-13 01:00:10.835
143	product.brand.update	web	2025-10-13 01:00:10.837	2025-10-13 01:00:10.837
144	product.brand.delete	web	2025-10-13 01:00:10.839	2025-10-13 01:00:10.839
145	product.unit.view	web	2025-10-13 01:00:10.84	2025-10-13 01:00:10.84
146	product.unit.create	web	2025-10-13 01:00:10.842	2025-10-13 01:00:10.842
147	product.unit.update	web	2025-10-13 01:00:10.843	2025-10-13 01:00:10.843
148	product.unit.delete	web	2025-10-13 01:00:10.844	2025-10-13 01:00:10.844
149	product.warranty.view	web	2025-10-13 01:00:10.845	2025-10-13 01:00:10.845
150	product.warranty.create	web	2025-10-13 01:00:10.846	2025-10-13 01:00:10.846
151	product.warranty.update	web	2025-10-13 01:00:10.847	2025-10-13 01:00:10.847
152	product.warranty.delete	web	2025-10-13 01:00:10.849	2025-10-13 01:00:10.849
153	report.sales.view	web	2025-10-13 01:00:10.851	2025-10-13 01:00:10.851
154	report.sales.daily	web	2025-10-13 01:00:10.853	2025-10-13 01:00:10.853
155	report.sales.profitability	web	2025-10-13 01:00:10.854	2025-10-13 01:00:10.854
156	report.purchase.view	web	2025-10-13 01:00:10.855	2025-10-13 01:00:10.855
157	report.purchase.analytics	web	2025-10-13 01:00:10.856	2025-10-13 01:00:10.856
158	report.purchase.trends	web	2025-10-13 01:00:10.857	2025-10-13 01:00:10.857
159	report.purchase.items	web	2025-10-13 01:00:10.859	2025-10-13 01:00:10.859
160	report.transfer.view	web	2025-10-13 01:00:10.86	2025-10-13 01:00:10.86
161	report.transfer.trends	web	2025-10-13 01:00:10.862	2025-10-13 01:00:10.862
162	report.profitability	web	2025-10-13 01:00:10.864	2025-10-13 01:00:10.864
163	report.product_purchase_history	web	2025-10-13 01:00:10.866	2025-10-13 01:00:10.866
164	report.stock_alert	web	2025-10-13 01:00:10.867	2025-10-13 01:00:10.867
165	sales_report.journal	web	2025-10-14 00:26:53.099	2025-10-14 00:26:53.099
166	sales_report.per_item	web	2025-10-14 00:26:53.108	2025-10-14 00:26:53.108
167	sales_report.per_cashier	web	2025-10-14 00:26:53.112	2025-10-14 00:26:53.112
168	sales_report.analytics	web	2025-10-14 00:26:53.115	2025-10-14 00:26:53.115
169	inventory_ledger.view	web	2025-10-14 06:12:38.921	2025-10-14 06:18:37.482
170	inventory_ledger.export	web	2025-10-14 06:12:38.937	2025-10-14 06:18:37.491
173	sales_report.per_location	web	2025-10-17 00:48:20.657	2025-10-17 00:48:20.657
174	sales_report.customer_analysis	web	2025-10-17 00:48:20.657	2025-10-17 00:48:20.657
175	sales_report.payment_method	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
176	sales_report.discount_analysis	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
177	bank.update	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
178	bank_transaction.create	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
180	bank_transaction.delete	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
179	bank_transaction.update	web	2025-10-17 00:48:20.658	2025-10-17 00:48:20.658
181	report.sales.today	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
183	bank.create	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
182	bank.view	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
184	report.sales.history	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
185	view_inventory_reports	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
186	bank.delete	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
187	bank_transaction.view	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
188	freebie.add	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
189	audit_log.view	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
190	freebie.approve	web	2025-10-17 00:48:20.659	2025-10-17 00:48:20.659
191	freebie.view_log	web	2025-10-17 00:48:20.66	2025-10-17 00:48:20.66
\.


--
-- Data for Name: post_dated_cheques; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.post_dated_cheques (id, business_id, supplier_id, cheque_number, cheque_date, amount, bank_name, account_number, status, reminder_sent, reminder_sent_at, cleared_date, cleared_by, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_history (id, business_id, location_id, product_id, product_variation_id, transaction_type, transaction_date, reference_type, reference_id, reference_number, quantity_change, balance_quantity, unit_cost, total_value, created_by, created_by_name, reason, created_at) FROM stdin;
\.


--
-- Data for Name: product_serial_numbers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_serial_numbers (id, business_id, product_id, product_variation_id, "serialNumber", imei, status, condition, current_location_id, purchase_id, purchase_receipt_id, purchased_at, purchase_cost, sale_id, sold_at, sold_to, warranty_start_date, warranty_end_date, notes, created_at, updated_at, supplier_id, sale_price) FROM stdin;
\.


--
-- Data for Name: product_variations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_variations (id, product_id, business_id, name, sku, purchase_price, selling_price, is_default, sub_sku, created_at, updated_at, deleted_at, unit_id, supplier_id) FROM stdin;
2	2	1	Default	PCI-0002	450.0000	495.0000	t	\N	2025-10-08 03:34:10.741	2025-10-10 00:52:43.18	\N	1	\N
6	4	1	Default	PCI-0004	450.0000	450.0000	t	\N	2025-10-11 02:35:09.991	2025-10-11 02:35:09.991	\N	1	\N
10001	10001	1	Default	LAPTOP-7490	45000.0000	54000.0000	f	\N	2025-10-11 15:53:21.969	2025-10-11 15:53:21.969	\N	1	\N
10002	10002	1	Default	MOUSE-MX3	4500.0000	5850.0000	f	\N	2025-10-11 15:53:22.041	2025-10-11 15:53:22.041	\N	1	\N
10003	10003	1	Default	KB-K8	5500.0000	6875.0000	f	\N	2025-10-11 15:53:22.059	2025-10-11 15:53:22.059	\N	1	\N
10004	10004	1	Default	MON-U2720Q	22000.0000	25960.0000	f	\N	2025-10-11 15:53:22.079	2025-10-11 15:53:22.079	\N	1	\N
7	5	1	WD 128	PCI-0005-1	1500.0000	1700.0000	t	\N	2025-10-11 04:46:28.249	2025-10-11 20:07:23.649	\N	\N	\N
8	5	1	WD 256	PCI-0005-2	3000.0000	3400.0000	f	\N	2025-10-11 04:46:28.252	2025-10-11 20:07:23.796	\N	\N	\N
1	1	1	Default	PCI-0001	150.0000	165.0000	t	\N	2025-10-08 03:07:12.528	2025-10-14 14:35:28.627	\N	1	\N
3	3	1	Samsung SSD 128	PCI-0003-1	2500.0000	2900.0100	t	\N	2025-10-11 02:33:40.473	2025-10-15 12:21:34.377	\N	\N	\N
4	3	1	Samsung SSD 256	PCI-0003-2	5000.0000	5800.0000	f	\N	2025-10-11 02:33:40.603	2025-10-15 12:21:34.768	\N	\N	\N
5	3	1	Samsung SSD 512	PCI-0003-3	6000.0000	7200.0000	f	\N	2025-10-11 02:33:40.611	2025-10-15 12:21:35.169	\N	\N	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, business_id, name, type, category_id, brand_id, unit_id, tax_id, tax_type, sku, barcode_type, description, product_description, image, brochure, enable_stock, alert_quantity, purchase_price, selling_price, weight, preparation_time, enable_product_info, not_for_selling, is_active, created_at, updated_at, deleted_at, margin_percentage, enable_auto_reorder, lead_time_days, reorder_point, reorder_quantity, safety_stock_days) FROM stdin;
4	1	Service Fee	single	7	\N	1	\N	inclusive	PCI-0004	Code128		Basic Service Fee			f	\N	450.0000	450.0000	\N	\N	f	t	t	2025-10-11 02:35:09.986	2025-10-11 02:35:09.989	\N	0.00	f	\N	\N	\N	\N
5	1	Western Digital SSD	variable	9	8	1	1	inclusive	PCI-0005	Code128					t	\N	\N	\N	\N	\N	t	f	t	2025-10-11 04:46:28.238	2025-10-11 04:46:28.244	\N	\N	f	\N	\N	\N	\N
2	1	Generic PS	single	3	5	1	1	inclusive	PCI-0002	Code128		Generic Power supply			t	10.0000	450.0000	495.0000	\N	\N	t	f	t	2025-10-08 03:34:10.733	2025-10-11 13:59:04.979	\N	10.00	f	\N	\N	\N	\N
10001	1	Dell Latitude 7490 Laptop	single	\N	\N	1	\N	\N	LAPTOP-7490	\N	\N	\N	\N	\N	t	5.0000	\N	\N	\N	\N	f	f	t	2025-10-11 15:47:39.888	2025-10-11 15:47:39.888	\N	\N	f	\N	\N	\N	\N
10002	1	Logitech MX Master 3 Mouse	single	\N	\N	1	\N	\N	MOUSE-MX3	\N	\N	\N	\N	\N	t	10.0000	\N	\N	\N	\N	f	f	t	2025-10-11 15:53:22.031	2025-10-11 15:53:22.031	\N	\N	f	\N	\N	\N	\N
10003	1	Keychron K8 Mechanical Keyboard	single	\N	\N	1	\N	\N	KB-K8	\N	\N	\N	\N	\N	t	15.0000	\N	\N	\N	\N	f	f	t	2025-10-11 15:53:22.051	2025-10-11 15:53:22.051	\N	\N	f	\N	\N	\N	\N
1	1	Generic Mouse	single	8	5	1	1	inclusive	PCI-0001	Code128		Generic Mouse			t	500.0000	150.0000	165.0000	1.0000	1	f	f	t	2025-10-08 03:07:12.495	2025-10-10 09:13:42.335	\N	10.00	f	\N	\N	\N	\N
3	1	Samsung SSD	variable	9	7	\N	1	inclusive	PCI-0003	Code128		Samsung 128,256,512, 1 TB			t	\N	\N	\N	1.0000	1	t	f	t	2025-10-11 02:33:40.434	2025-10-11 02:33:40.469	\N	\N	f	\N	\N	\N	\N
10004	1	Dell 27" UltraSharp Monitor	single	\N	\N	1	\N	\N	MON-U2720Q	\N	\N	\N	\N	\N	t	8.0000	\N	\N	\N	\N	f	f	t	2025-10-11 15:53:22.068	2025-10-15 00:32:10.811	\N	\N	f	\N	\N	\N	\N
\.


--
-- Data for Name: purchase_amendments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_amendments (id, purchase_id, business_id, amendment_number, amendment_date, status, amendment_reason, previous_data, changed_fields, new_subtotal, new_tax_amount, new_total_amount, description, notes, requested_by, requested_at, approved_by, approved_at, rejected_by, rejected_at, rejection_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_items (id, purchase_id, product_id, product_variation_id, quantity, unit_cost, quantity_received, requires_serial, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_receipt_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_receipt_items (id, purchase_receipt_id, purchase_item_id, product_id, product_variation_id, quantity_received, serial_numbers, notes, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_receipts (id, business_id, purchase_id, location_id, receipt_number, receipt_date, status, notes, received_by, received_at, approved_by, approved_at, created_at, updated_at, supplier_id) FROM stdin;
\.


--
-- Data for Name: purchase_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_return_items (id, purchase_return_id, purchase_receipt_item_id, product_id, product_variation_id, quantity_returned, unit_cost, serial_numbers, condition, notes, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_returns (id, business_id, location_id, purchase_receipt_id, supplier_id, return_number, return_date, status, return_reason, subtotal, tax_amount, discount_amount, total_amount, expected_action, notes, created_by, created_at, updated_at, approved_by, approved_at, completed_by, completed_at) FROM stdin;
\.


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchases (id, business_id, location_id, supplier_id, purchase_order_number, purchase_date, expected_delivery_date, status, subtotal, tax_amount, discount_amount, shipping_cost, total_amount, notes, created_by, created_at, updated_at, deleted_at, amendment_count, is_amended) FROM stdin;
\.


--
-- Data for Name: qc_checklist_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qc_checklist_templates (id, business_id, name, description, category_ids, product_ids, check_items, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quality_control_check_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_control_check_items (id, quality_control_inspection_id, checklist_template_id, check_name, check_category, check_result, check_value, expected_value, is_critical, notes, created_at) FROM stdin;
\.


--
-- Data for Name: quality_control_inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_control_inspections (id, business_id, location_id, purchase_receipt_id, inspection_number, inspection_date, status, overall_result, inspected_by, inspected_at, inspector_notes, approved_by, approved_at, approval_notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quality_control_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_control_items (id, quality_control_inspection_id, purchase_receipt_item_id, product_id, product_variation_id, quantity_ordered, quantity_received, quantity_inspected, quantity_passed, quantity_failed, inspection_result, defect_type, defect_description, defect_severity, action_taken, notes, created_at) FROM stdin;
\.


--
-- Data for Name: quotation_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotation_items (id, quotation_id, product_id, product_variation_id, quantity, unit_price, created_at) FROM stdin;
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotations (id, business_id, location_id, customer_id, quotation_number, quotation_date, expiry_date, valid_days, subtotal, tax_amount, discount_amount, total_amount, status, converted_to_sale_id, notes, created_by, created_at, updated_at, customer_name) FROM stdin;
\.


--
-- Data for Name: role_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_locations (role_id, location_id, created_at) FROM stdin;
8	5	2025-10-08 05:48:08.521
8	3	2025-10-08 05:48:08.522
8	2	2025-10-08 05:48:08.522
8	6	2025-10-08 05:48:08.521
8	1	2025-10-08 05:48:08.523
8	4	2025-10-08 05:48:08.522
9	3	2025-10-12 06:04:56.336
3	1	2025-10-12 06:06:01.844
10	2	2025-10-12 08:03:26.469
11	1	2025-10-12 08:29:27.556
6	1	2025-10-13 13:37:09.986
7	2	2025-10-16 12:39:56.628
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
9	1
9	23
9	18
9	25
9	31
9	51
9	57
9	82
9	86
9	89
9	92
9	97
9	100
9	102
9	105
3	1
3	2
3	24
3	37
3	23
3	43
3	44
3	62
3	88
3	92
3	100
10	19
11	34
1	137
1	138
1	139
1	140
1	141
1	142
1	143
2	123
2	124
2	125
2	126
2	127
2	128
2	129
2	130
2	131
2	132
2	133
2	134
2	135
2	136
1	123
1	124
1	125
1	126
1	127
1	128
1	129
1	130
1	131
1	132
1	133
1	134
1	135
1	136
1	144
1	145
1	146
1	147
6	1
6	128
6	132
6	41
6	125
1	148
1	149
1	150
1	151
1	152
1	165
1	166
1	167
1	173
1	168
1	174
1	175
1	176
1	118
1	119
1	120
6	51
6	153
1	121
1	122
1	182
6	165
2	1
2	27
2	29
2	38
2	81
2	80
2	53
2	84
2	79
2	85
2	87
2	91
2	93
2	83
2	88
2	82
2	94
2	89
2	90
2	92
2	86
2	50
2	3
2	23
2	2
2	6
2	4
2	5
2	7
2	20
2	12
2	16
2	9
2	13
2	34
2	15
2	17
2	14
2	37
2	19
2	44
2	22
2	36
2	39
2	49
2	40
2	42
2	41
2	43
2	45
2	47
2	54
2	48
2	60
2	51
2	55
2	52
2	58
2	59
2	56
2	62
2	61
2	64
2	65
8	100
8	101
8	105
8	102
8	103
8	106
6	166
6	167
6	168
7	6
7	48
7	54
7	80
7	85
7	95
7	97
7	100
7	103
7	106
7	116
7	138
7	142
7	146
7	156
7	160
7	12
7	14
7	13
7	34
1	183
1	177
1	186
1	187
1	178
1	179
1	180
1	153
1	154
1	181
4	1
4	85
4	83
4	4
4	12
4	16
4	9
4	36
4	39
4	49
4	42
4	47
4	54
4	48
4	51
4	55
4	52
4	58
5	1
5	85
5	4
5	5
5	7
5	42
5	41
5	58
1	184
1	155
1	156
1	157
1	158
1	159
9	2
9	19
9	30
9	36
9	41
9	43
9	58
9	87
1	160
1	161
1	2
1	14
1	17
1	20
1	23
1	33
1	39
1	43
1	52
1	53
1	162
1	163
1	164
1	185
1	189
1	188
1	190
1	191
2	8
2	10
2	11
2	95
1	59
1	66
1	69
1	73
1	75
1	80
1	84
1	93
1	99
1	101
1	103
1	105
1	108
1	110
1	113
1	115
1	6
1	9
1	36
1	8
1	13
2	118
2	119
2	120
2	121
2	122
2	114
2	115
2	116
2	117
2	108
2	109
2	110
2	111
2	112
2	113
8	1
8	2
8	3
8	4
8	15
8	18
8	21
8	22
8	23
8	26
8	28
8	30
8	31
8	34
8	35
8	36
8	37
8	41
8	42
8	43
8	44
8	46
8	47
8	48
8	49
8	50
8	51
8	52
8	54
8	55
8	56
8	58
8	59
8	60
8	61
8	62
8	63
8	64
8	65
8	82
8	83
8	86
8	85
8	87
8	88
8	89
8	90
8	91
8	92
8	93
8	94
8	6
8	8
8	9
8	11
8	10
8	13
8	45
8	25
8	17
8	12
8	32
8	14
8	39
8	33
8	19
8	40
8	16
9	98
3	6
3	19
3	36
3	41
3	50
3	86
3	89
3	97
2	182
10	14
10	85
2	183
2	177
2	186
2	187
2	178
2	179
2	180
2	181
6	18
6	85
6	127
1	169
1	170
2	169
2	170
4	169
4	170
7	2
7	35
7	51
7	57
7	82
7	91
7	94
7	99
7	101
2	96
2	97
2	98
2	99
2	104
2	100
2	101
2	105
2	102
2	103
7	105
7	115
7	117
7	139
7	143
7	147
4	97
4	98
4	99
4	104
4	100
4	101
4	105
4	102
4	103
7	10
7	32
7	46
2	184
2	185
2	189
2	188
2	190
2	191
3	137
3	141
3	145
3	149
3	4
3	123
3	124
3	125
3	126
3	127
2	106
9	14
9	24
9	21
9	27
9	32
9	37
9	39
9	42
3	128
3	129
3	130
3	131
3	132
3	133
3	134
3	135
3	136
3	165
3	166
3	167
3	173
3	168
3	174
3	175
3	176
9	44
9	50
9	88
1	3
1	26
1	28
1	30
1	38
1	42
1	50
1	51
1	55
1	57
1	62
1	64
1	67
1	68
1	72
1	74
1	77
1	82
1	87
1	88
1	92
1	95
1	98
1	100
1	37
1	16
1	47
1	34
3	12
3	16
3	9
3	95
3	96
3	8
3	10
3	11
3	118
3	119
3	120
3	122
3	114
3	115
3	116
3	108
3	109
3	110
3	111
3	112
3	187
9	94
3	7
3	14
3	27
3	58
3	105
3	47
10	34
3	54
3	48
3	153
3	154
3	181
3	184
6	21
6	123
6	130
7	8
7	37
7	52
7	58
7	83
7	87
7	96
7	98
7	102
7	104
7	114
7	137
7	141
7	145
7	159
7	15
7	30
7	19
3	160
3	161
3	164
3	169
3	190
3	191
4	8
4	11
4	118
4	119
4	120
4	182
4	183
4	177
4	186
4	187
4	178
4	179
4	180
5	181
5	184
6	181
6	184
9	6
9	15
9	34
9	49
3	15
3	17
3	34
3	39
1	1
1	15
1	22
1	25
1	31
1	40
1	41
1	45
1	49
1	54
1	56
1	58
1	61
1	63
1	65
1	70
1	76
1	79
1	83
1	86
1	89
1	91
1	96
1	5
1	12
1	7
1	10
3	49
3	85
3	94
3	101
6	24
6	124
6	136
7	11
7	16
7	26
7	22
9	17
9	62
9	85
9	91
9	101
3	5
3	20
3	42
1	4
1	18
1	21
1	24
1	27
1	29
1	32
1	44
1	48
1	60
1	71
1	78
1	81
1	85
1	90
1	94
1	97
1	102
1	104
1	106
1	109
1	111
1	112
1	114
1	116
1	117
1	46
1	11
1	19
1	35
3	51
3	87
3	91
3	98
3	102
10	82
11	19
2	137
2	138
2	139
2	140
2	141
2	142
2	143
2	144
2	145
2	146
2	147
2	148
2	149
2	150
2	151
2	152
2	153
2	154
2	155
2	156
2	157
2	158
2	159
2	160
2	161
2	162
2	163
2	164
4	156
4	157
4	158
4	159
4	162
4	163
5	153
5	164
6	5
6	134
6	42
6	135
7	9
7	17
7	44
7	47
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, guard_name, business_id, is_default, created_at, updated_at) FROM stdin;
1	Super Admin	web	1	t	2025-10-07 23:39:41.879	2025-10-13 00:41:35.054
2	Branch Admin	web	1	f	2025-10-07 23:39:41.882	2025-10-13 00:41:35.058
4	Accounting Staff	web	1	f	2025-10-07 23:39:41.884	2025-10-13 00:41:35.059
5	Regular Staff	web	1	f	2025-10-07 23:39:41.885	2025-10-13 00:41:35.06
8	All Branch Admin	web	1	f	2025-10-08 05:48:08.251	2025-10-13 00:41:35.062
9	Bambang Branch Manager	web	1	f	2025-10-12 06:02:05.938	2025-10-13 00:41:35.064
3	Main Branch Manager	web	1	f	2025-10-07 23:39:41.883	2025-10-13 00:41:35.065
10	Warehouse Transfer Sender	web	1	f	2025-10-12 08:00:10.298	2025-10-13 00:41:35.066
11	Main Store Transfer Verifier	web	1	f	2025-10-12 08:23:29.249	2025-10-13 00:41:35.067
6	Regular Cashier Main	web	1	f	2025-10-07 23:39:41.886	2025-10-13 13:37:09.821
7	Warehouse Manager	web	1	f	2025-10-08 03:56:28.544	2025-10-16 12:39:56.434
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_items (id, sale_id, product_id, product_variation_id, quantity, unit_price, unit_cost, serial_numbers, created_at) FROM stdin;
\.


--
-- Data for Name: sale_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_payments (id, sale_id, payment_method, amount, reference_number, paid_at) FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (id, business_id, location_id, customer_id, invoice_number, sale_date, status, subtotal, tax_amount, discount_amount, shipping_cost, total_amount, notes, created_by, created_at, updated_at, deleted_at, discount_approved_by, discount_type, pwd_id, pwd_name, senior_citizen_id, senior_citizen_name, shift_id, vat_exempt, warranty_terms) FROM stdin;
\.


--
-- Data for Name: serial_number_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.serial_number_movements (id, serial_number_id, "movementType", from_location_id, to_location_id, "referenceType", reference_id, notes, moved_by, moved_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, session_token, user_id, expires) FROM stdin;
\.


--
-- Data for Name: stock_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_transactions (id, business_id, product_id, product_variation_id, location_id, type, quantity, unit_cost, balance_qty, reference_type, reference_id, created_by, notes, created_at) FROM stdin;
\.


--
-- Data for Name: stock_transfer_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_transfer_items (id, stock_transfer_id, product_id, product_variation_id, quantity, serial_numbers_sent, serial_numbers_received, received_quantity, verified, verified_by, verified_at, has_discrepancy, discrepancy_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_transfers (id, business_id, transfer_number, from_location_id, to_location_id, transfer_date, status, stock_deducted, notes, created_by, checked_by, checked_at, checker_notes, sent_by, sent_at, arrived_by, arrived_at, verified_by, verified_at, verifier_notes, completed_by, completed_at, received_by, received_at, cancelled_by, cancelled_at, cancellation_reason, has_discrepancy, discrepancy_notes, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, business_id, package_id, start_date, trial_end_date, end_date, package_price, package_details, paid_via, payment_transaction_id, status, created_by, created_at, updated_at) FROM stdin;
1	1	4	2025-10-07	2025-11-06	\N	299.9900	{"id": 4, "name": "Enterprise", "price": 299.99, "interval": "months", "isActive": true, "createdAt": "2025-10-07T23:39:42.134Z", "isPrivate": false, "sortOrder": 4, "trialDays": 30, "updatedAt": "2025-10-07T23:39:42.134Z", "userCount": 999, "description": "For large businesses with unlimited needs", "invoiceCount": null, "productCount": 999999, "intervalCount": 1, "locationCount": 999, "customPermissions": {"modules": ["all"], "features": ["all"]}}	\N	\N	approved	1	2025-10-07 23:39:42.137	2025-10-07 23:39:42.137
\.


--
-- Data for Name: supplier_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_return_items (id, supplier_return_id, product_id, product_variation_id, quantity, unit_cost, serial_numbers, condition, notes, created_at) FROM stdin;
\.


--
-- Data for Name: supplier_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_returns (id, business_id, location_id, supplier_id, return_number, return_date, status, return_reason, total_amount, notes, created_by, created_at, approved_by, approved_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, business_id, name, contact_person, email, mobile, alternate_number, address, city, state, country, zip_code, tax_number, payment_terms, credit_limit, is_active, created_at, updated_at, deleted_at) FROM stdin;
1	1	Sample Supplier	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-09 10:33:04.366	2025-10-09 10:33:04.366	\N
2	1	Sample Supplier1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-09 10:59:51.042	2025-10-09 10:59:51.042	\N
3	1	Sample Supplier2	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-11 02:36:28.533	2025-10-11 02:36:28.533	\N
4	1	Supplier4	\N	Supplier4@gmail.com	12637484590	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-15 08:38:59.249	2025-10-15 08:38:59.249	\N
\.


--
-- Data for Name: tax_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_rates (id, business_id, name, amount, is_default, created_at, updated_at, deleted_at) FROM stdin;
2	1	Reduced VAT	5.00	f	2025-10-07 23:39:42.16	2025-10-07 23:39:42.16	\N
1	1	Standard VAT	12.00	t	2025-10-07 23:39:42.158	2025-10-08 01:38:08.056	\N
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units (id, business_id, name, short_name, allow_decimal, created_at, updated_at, deleted_at) FROM stdin;
1	1	Pieces	Pc(s)	f	2025-10-07 23:39:42.154	2025-10-07 23:39:42.154	\N
2	1	Box	Box	f	2025-10-07 23:39:42.157	2025-10-07 23:39:42.157	\N
3	1	Pack	Pck	f	2025-10-08 01:26:42.099	2025-10-08 01:26:42.099	\N
\.


--
-- Data for Name: user_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_locations (user_id, location_id, created_at) FROM stdin;
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (user_id, permission_id) FROM stdin;
1	12
1	16
1	9
1	13
1	95
1	96
1	8
1	10
1	11
1	106
1	118
1	119
1	120
1	121
1	122
1	114
1	115
1	116
1	117
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id) FROM stdin;
1	1
9	4
13	8
8	3
15	3
16	3
17	3
12	7
14	3
10	10
7	11
11	6
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, surname, first_name, last_name, username, email, password, language, business_id, contact_number, alt_number, family_number, allow_login, user_type, selected_contacts, max_sale_discount, theme, theme_mode, sidebar_style, created_at, updated_at, deleted_at) FROM stdin;
9	Robert	Davis	Warehouse Manager	warehousemanager	warehouse@ultimatepos.com	$2b$10$0q4qsVGdJSr4faT9/8eQh.AaM9RJsYX1ACQGvBnWWO2l.uOGgQYyi	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-07 23:42:39.756	2025-10-07 23:42:39.756	\N
1	Super	Admin	User	superadmin	superadmin@ultimatepos.com	$2b$10$YWQWznMwJiwcx4.9.8O1PuR18SlXEoTlvKqAb/gKCLJf521dy/0hO	en     	1	\N	\N	\N	t	user	f	\N	light	dark	default	2025-10-07 23:39:41.684	2025-10-17 00:53:28.942	\N
7	Transfer	Main Store	Verifier	mainverifier	branchadmin@ultimatepos.com	$2b$10$qzl6p4iCmdXxk1q.WtyrXOnypbI6ZEKX8.DJbAXRMuASxfO1BPV/m	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-07 23:42:39.752	2025-10-12 09:02:13.378	\N
10	Sender	Warehouse	Transfer	warehousesender	staff@ultimatepos.com	$2b$10$1MXdTiBhlxNTR0n6mQiQCO4kw/lQcmRRQcuLBkmcXWKulb47Y6Qn2	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-07 23:42:39.757	2025-10-12 09:09:51.216	\N
11	Main	Store	Cashier	cashiermain	rr3800@gmail.com	$2b$10$hezxg9lrnGpCG8faNF0CUuJhGMyL0.PI1hv3PJy8XwLZg55gwJhw2	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-07 23:42:39.758	2025-10-16 11:29:09.19	\N
13	Atty.	Gem	Hiadan	Gemski	\N	$2b$10$3tuAD/uQCw3seeNqS5cLd.8S0Xemy1V4v01Pg/JKkw.ljaPp5x7KC	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-08 05:48:47.562	2025-10-09 04:08:50.59	\N
14	Santos	Carlos	Main Store Manager	mainmgr	carlos.santos@test.com	$2b$10$KeQwatEN4cAxg1FOQc4UceNq3S8XtZPU2oKS/tBPzsbJd9MWjs3/e	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-11 15:47:39.677	2025-10-13 12:20:50.935	\N
15	Garcia	Maria	Branch Manager	makati_mgr	maria.garcia@test.com	$2b$10$P5cC7ri7hfXPs1JVDovahuM2.ReTNNuSQi/a1W4gZxzlZJCkBlSRm	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-11 15:47:39.73	2025-10-11 15:47:39.73	\N
16	Dela Cruz	Juan	Branch Manager	pasig_mgr	juan.delacruz@test.com	$2b$10$P5cC7ri7hfXPs1JVDovahuM2.ReTNNuSQi/a1W4gZxzlZJCkBlSRm	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-11 15:47:39.75	2025-10-11 15:47:39.75	\N
17	Reyes	Ana	Branch Manager	cebu_mgr	ana.reyes@test.com	$2b$10$P5cC7ri7hfXPs1JVDovahuM2.ReTNNuSQi/a1W4gZxzlZJCkBlSRm	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-11 15:47:39.783	2025-10-11 15:47:39.783	\N
8	Jane	Smith	Manager	branchmanager	branchmanager@ultimatepos.com	$2b$10$t6p8KO9CSWINQrQoYgJxfewhl/y3AEV67Dqz877wiC78NO92RJ.PC	en     	1	\N	\N	\N	t	user	f	\N	light	light	default	2025-10-07 23:42:39.755	2025-10-12 09:19:41.416	\N
12	Terre	Jheirone	Terre	Jheirone	\N	$2b$10$H6hlLN6IuaA5qjSv8pkWme9I3NscgzQOaa0vZHLkvYM63yZUlI3OS	en     	1	\N	\N	\N	t	user	f	\N	sunset	dark	default	2025-10-08 03:54:06.259	2025-10-17 00:36:08.288	\N
\.


--
-- Data for Name: variation_location_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.variation_location_details (id, product_id, product_variation_id, location_id, qty_available, selling_price, opening_stock_locked, opening_stock_set_at, opening_stock_set_by, created_at, updated_at) FROM stdin;
2	1	1	2	0.0000	150.0000	f	\N	\N	2025-10-08 03:07:12.539	2025-10-17 09:02:45.632
24	3	3	2	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
10	2	2	2	0.0000	495.0000	f	\N	\N	2025-10-08 03:34:10.749	2025-10-17 09:02:45.632
4	1	1	4	0.0000	150.0000	f	\N	\N	2025-10-08 03:07:12.539	2025-10-17 09:02:45.632
3	1	1	3	0.0000	150.0000	f	\N	\N	2025-10-08 03:07:12.539	2025-10-17 09:02:45.632
9	2	2	1	0.0000	495.0000	f	\N	\N	2025-10-08 03:34:10.749	2025-10-17 09:02:45.632
11	2	2	3	0.0000	495.0000	f	\N	\N	2025-10-08 03:34:10.749	2025-10-17 09:02:45.632
12	2	2	4	0.0000	495.0000	f	\N	\N	2025-10-08 03:34:10.749	2025-10-17 09:02:45.632
13	1	1	5	0.0000	165.0000	f	\N	\N	2025-10-08 05:42:31.406	2025-10-17 09:02:45.632
14	2	2	5	0.0000	495.0000	f	\N	\N	2025-10-08 05:42:31.406	2025-10-17 09:02:45.632
15	1	1	6	0.0000	165.0000	f	\N	\N	2025-10-08 05:42:55.927	2025-10-17 09:02:45.632
16	2	2	6	0.0000	495.0000	f	\N	\N	2025-10-08 05:42:55.927	2025-10-17 09:02:45.632
21	3	3	1	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
22	3	4	1	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
23	3	5	1	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
27	3	3	3	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
28	3	4	3	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
29	3	5	3	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
30	3	3	4	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
31	3	4	4	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
32	3	5	4	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
33	3	3	5	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
34	3	4	5	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
35	3	5	5	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
36	3	3	6	0.0000	2900.0100	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
37	3	4	6	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
38	3	5	6	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
39	4	6	1	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
40	4	6	2	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
41	4	6	3	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
42	4	6	4	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
43	4	6	5	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
44	4	6	6	0.0000	450.0000	f	\N	\N	2025-10-11 02:35:09.996	2025-10-17 09:02:45.632
1	1	1	1	0.0000	150.0000	f	\N	\N	2025-10-08 03:07:12.539	2025-10-17 09:02:45.632
51	5	7	1	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
52	5	8	1	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
55	5	7	3	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
56	5	8	3	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
57	5	7	4	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
58	5	8	4	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
59	5	7	5	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
60	5	8	5	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
61	5	7	6	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
62	5	8	6	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
63	10001	10001	100	0.0000	\N	f	\N	\N	2025-10-11 15:53:22.01	2025-10-17 09:02:45.632
64	10002	10002	100	0.0000	\N	f	\N	\N	2025-10-11 15:53:22.046	2025-10-17 09:02:45.632
65	10003	10003	100	0.0000	\N	f	\N	\N	2025-10-11 15:53:22.064	2025-10-17 09:02:45.632
66	10004	10004	100	0.0000	\N	f	\N	\N	2025-10-11 15:53:22.084	2025-10-17 09:02:45.632
67	10004	10004	101	0.0000	\N	f	\N	\N	2025-10-11 15:53:22.087	2025-10-17 09:02:45.632
70	10002	10002	1	0.0000	\N	f	\N	\N	2025-10-14 08:53:48.183	2025-10-17 09:02:45.632
25	3	4	2	0.0000	5800.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
26	3	5	2	0.0000	7200.0000	f	\N	\N	2025-10-11 02:33:40.624	2025-10-17 09:02:45.632
81	10004	10004	1	0.0000	\N	f	\N	\N	2025-10-14 08:59:05.613	2025-10-17 09:02:45.632
54	5	8	2	0.0000	3400.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
53	5	7	2	0.0000	1700.0000	f	\N	\N	2025-10-11 04:46:28.266	2025-10-17 09:02:45.632
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification_tokens (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: void_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.void_transactions (id, business_id, location_id, sale_id, void_reason, original_amount, voided_by, approved_by, approved_at, requires_manager_approval, created_at) FROM stdin;
\.


--
-- Data for Name: warranties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warranties (id, business_id, name, description, duration, duration_type, created_at, updated_at, deleted_at) FROM stdin;
1	1	1 Year Warranty	1 Year Warranty	12	months	2025-10-08 11:39:34.749	2025-10-08 11:39:34.749	\N
\.


--
-- Data for Name: warranty_claims; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warranty_claims (id, business_id, location_id, sale_id, product_id, product_variation_id, serial_number, claim_number, claim_date, issue_description, claim_type, status, replacement_type, replaced_with_serial_number, is_user_negligence, notes, created_by, created_at, resolved_at) FROM stdin;
\.


--
-- Name: accounts_payable_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accounts_payable_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: bank_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bank_transactions_id_seq', 1, false);


--
-- Name: banks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.banks_id_seq', 1, false);


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 8, true);


--
-- Name: business_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_id_seq', 1, true);


--
-- Name: business_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_locations_id_seq', 6, true);


--
-- Name: cash_denominations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cash_denominations_id_seq', 1, false);


--
-- Name: cash_in_out_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cash_in_out_id_seq', 1, false);


--
-- Name: cashier_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cashier_shifts_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 9, true);


--
-- Name: combo_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.combo_products_id_seq', 1, false);


--
-- Name: currencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.currencies_id_seq', 1, true);


--
-- Name: customer_return_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_return_items_id_seq', 1, false);


--
-- Name: customer_returns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_returns_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 3, true);


--
-- Name: debit_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.debit_notes_id_seq', 1, false);


--
-- Name: discount_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.discount_configs_id_seq', 1, false);


--
-- Name: freebie_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.freebie_logs_id_seq', 1, false);


--
-- Name: inventory_corrections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_corrections_id_seq', 1, false);


--
-- Name: packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.packages_id_seq', 4, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.permissions_id_seq', 191, true);


--
-- Name: post_dated_cheques_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_dated_cheques_id_seq', 1, false);


--
-- Name: product_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_history_id_seq', 1, false);


--
-- Name: product_serial_numbers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_serial_numbers_id_seq', 1, false);


--
-- Name: product_variations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_variations_id_seq', 8, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 5, true);


--
-- Name: purchase_amendments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_amendments_id_seq', 1, false);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_items_id_seq', 1, false);


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_receipt_items_id_seq', 1, false);


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_receipts_id_seq', 1, false);


--
-- Name: purchase_return_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_return_items_id_seq', 1, false);


--
-- Name: purchase_returns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_returns_id_seq', 1, false);


--
-- Name: purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchases_id_seq', 1, false);


--
-- Name: qc_checklist_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.qc_checklist_templates_id_seq', 1, false);


--
-- Name: quality_control_check_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quality_control_check_items_id_seq', 1, false);


--
-- Name: quality_control_inspections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quality_control_inspections_id_seq', 1, false);


--
-- Name: quality_control_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quality_control_items_id_seq', 1, false);


--
-- Name: quotation_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotation_items_id_seq', 1, false);


--
-- Name: quotations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotations_id_seq', 1, false);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 11, true);


--
-- Name: sale_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sale_items_id_seq', 1, false);


--
-- Name: sale_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sale_payments_id_seq', 1, false);


--
-- Name: sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_id_seq', 1, false);


--
-- Name: serial_number_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.serial_number_movements_id_seq', 1, false);


--
-- Name: stock_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_transactions_id_seq', 1, false);


--
-- Name: stock_transfer_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_transfer_items_id_seq', 1, false);


--
-- Name: stock_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_transfers_id_seq', 1, false);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 1, true);


--
-- Name: supplier_return_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_return_items_id_seq', 1, false);


--
-- Name: supplier_returns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.supplier_returns_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 4, true);


--
-- Name: tax_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tax_rates_id_seq', 2, true);


--
-- Name: units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.units_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 17, true);


--
-- Name: variation_location_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.variation_location_details_id_seq', 95, true);


--
-- Name: void_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.void_transactions_id_seq', 1, false);


--
-- Name: warranties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranties_id_seq', 1, true);


--
-- Name: warranty_claims_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_claims_id_seq', 1, false);


--
-- Name: _AccountsPayableToPurchaseReturn _AccountsPayableToPurchaseReturn_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_AccountsPayableToPurchaseReturn"
    ADD CONSTRAINT "_AccountsPayableToPurchaseReturn_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: accounts_payable accounts_payable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts_payable
    ADD CONSTRAINT accounts_payable_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: business_locations business_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_locations
    ADD CONSTRAINT business_locations_pkey PRIMARY KEY (id);


--
-- Name: business business_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_pkey PRIMARY KEY (id);


--
-- Name: cash_denominations cash_denominations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_denominations
    ADD CONSTRAINT cash_denominations_pkey PRIMARY KEY (id);


--
-- Name: cash_in_out cash_in_out_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_in_out
    ADD CONSTRAINT cash_in_out_pkey PRIMARY KEY (id);


--
-- Name: cashier_shifts cashier_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cashier_shifts
    ADD CONSTRAINT cashier_shifts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: combo_products combo_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.combo_products
    ADD CONSTRAINT combo_products_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customer_return_items customer_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_return_items
    ADD CONSTRAINT customer_return_items_pkey PRIMARY KEY (id);


--
-- Name: customer_returns customer_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_returns
    ADD CONSTRAINT customer_returns_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: debit_notes debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_pkey PRIMARY KEY (id);


--
-- Name: discount_configs discount_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discount_configs
    ADD CONSTRAINT discount_configs_pkey PRIMARY KEY (id);


--
-- Name: freebie_logs freebie_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_corrections inventory_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: post_dated_cheques post_dated_cheques_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_dated_cheques
    ADD CONSTRAINT post_dated_cheques_pkey PRIMARY KEY (id);


--
-- Name: product_history product_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_history
    ADD CONSTRAINT product_history_pkey PRIMARY KEY (id);


--
-- Name: product_serial_numbers product_serial_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_pkey PRIMARY KEY (id);


--
-- Name: product_variations product_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_amendments purchase_amendments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_amendments
    ADD CONSTRAINT purchase_amendments_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipt_items purchase_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_items purchase_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: qc_checklist_templates qc_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_checklist_templates
    ADD CONSTRAINT qc_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: quality_control_check_items quality_control_check_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_check_items
    ADD CONSTRAINT quality_control_check_items_pkey PRIMARY KEY (id);


--
-- Name: quality_control_inspections quality_control_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_inspections
    ADD CONSTRAINT quality_control_inspections_pkey PRIMARY KEY (id);


--
-- Name: quality_control_items quality_control_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_items
    ADD CONSTRAINT quality_control_items_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: role_locations role_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_locations
    ADD CONSTRAINT role_locations_pkey PRIMARY KEY (role_id, location_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_payments sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: serial_number_movements serial_number_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.serial_number_movements
    ADD CONSTRAINT serial_number_movements_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: stock_transactions stock_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_items stock_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: supplier_return_items supplier_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_returns supplier_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tax_rates tax_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: user_locations user_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_pkey PRIMARY KEY (user_id, location_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: variation_location_details variation_location_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variation_location_details
    ADD CONSTRAINT variation_location_details_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: void_transactions void_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_transactions
    ADD CONSTRAINT void_transactions_pkey PRIMARY KEY (id);


--
-- Name: warranties warranties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranties
    ADD CONSTRAINT warranties_pkey PRIMARY KEY (id);


--
-- Name: warranty_claims warranty_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_claims
    ADD CONSTRAINT warranty_claims_pkey PRIMARY KEY (id);


--
-- Name: _AccountsPayableToPurchaseReturn_B_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "_AccountsPayableToPurchaseReturn_B_index" ON public."_AccountsPayableToPurchaseReturn" USING btree ("B");


--
-- Name: accounts_payable_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_payable_business_id_idx ON public.accounts_payable USING btree (business_id);


--
-- Name: accounts_payable_due_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_payable_due_date_idx ON public.accounts_payable USING btree (due_date);


--
-- Name: accounts_payable_payment_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_payable_payment_status_idx ON public.accounts_payable USING btree (payment_status);


--
-- Name: accounts_payable_purchase_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_payable_purchase_id_idx ON public.accounts_payable USING btree (purchase_id);


--
-- Name: accounts_payable_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accounts_payable_supplier_id_idx ON public.accounts_payable USING btree (supplier_id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_business_id_idx ON public.audit_logs USING btree (business_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_entity_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_entity_type_idx ON public.audit_logs USING btree (entity_type);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: bank_transactions_bank_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bank_transactions_bank_id_idx ON public.bank_transactions USING btree (bank_id);


--
-- Name: bank_transactions_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bank_transactions_business_id_idx ON public.bank_transactions USING btree (business_id);


--
-- Name: bank_transactions_payment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bank_transactions_payment_id_idx ON public.bank_transactions USING btree (payment_id);


--
-- Name: bank_transactions_transaction_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bank_transactions_transaction_date_idx ON public.bank_transactions USING btree (transaction_date);


--
-- Name: bank_transactions_transaction_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bank_transactions_transaction_type_idx ON public.bank_transactions USING btree (transaction_type);


--
-- Name: banks_account_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX banks_account_type_idx ON public.banks USING btree (account_type);


--
-- Name: banks_business_id_account_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX banks_business_id_account_number_key ON public.banks USING btree (business_id, account_number);


--
-- Name: banks_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX banks_business_id_idx ON public.banks USING btree (business_id);


--
-- Name: brands_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX brands_business_id_idx ON public.brands USING btree (business_id);


--
-- Name: business_locations_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_locations_business_id_idx ON public.business_locations USING btree (business_id);


--
-- Name: cash_denominations_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_denominations_business_id_idx ON public.cash_denominations USING btree (business_id);


--
-- Name: cash_denominations_count_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_denominations_count_type_idx ON public.cash_denominations USING btree (count_type);


--
-- Name: cash_denominations_counted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_denominations_counted_at_idx ON public.cash_denominations USING btree (counted_at);


--
-- Name: cash_denominations_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_denominations_location_id_idx ON public.cash_denominations USING btree (location_id);


--
-- Name: cash_denominations_shift_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_denominations_shift_id_idx ON public.cash_denominations USING btree (shift_id);


--
-- Name: cash_in_out_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_in_out_business_id_idx ON public.cash_in_out USING btree (business_id);


--
-- Name: cash_in_out_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_in_out_created_at_idx ON public.cash_in_out USING btree (created_at);


--
-- Name: cash_in_out_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_in_out_location_id_idx ON public.cash_in_out USING btree (location_id);


--
-- Name: cash_in_out_shift_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_in_out_shift_id_idx ON public.cash_in_out USING btree (shift_id);


--
-- Name: cash_in_out_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cash_in_out_type_idx ON public.cash_in_out USING btree (type);


--
-- Name: cashier_shifts_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cashier_shifts_business_id_idx ON public.cashier_shifts USING btree (business_id);


--
-- Name: cashier_shifts_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cashier_shifts_location_id_idx ON public.cashier_shifts USING btree (location_id);


--
-- Name: cashier_shifts_opened_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cashier_shifts_opened_at_idx ON public.cashier_shifts USING btree (opened_at);


--
-- Name: cashier_shifts_shift_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cashier_shifts_shift_number_key ON public.cashier_shifts USING btree (shift_number);


--
-- Name: cashier_shifts_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cashier_shifts_status_idx ON public.cashier_shifts USING btree (status);


--
-- Name: cashier_shifts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cashier_shifts_user_id_idx ON public.cashier_shifts USING btree (user_id);


--
-- Name: categories_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_business_id_idx ON public.categories USING btree (business_id);


--
-- Name: categories_parent_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_parent_id_idx ON public.categories USING btree (parent_id);


--
-- Name: combo_products_child_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX combo_products_child_product_id_idx ON public.combo_products USING btree (child_product_id);


--
-- Name: combo_products_parent_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX combo_products_parent_product_id_idx ON public.combo_products USING btree (parent_product_id);


--
-- Name: currencies_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX currencies_code_key ON public.currencies USING btree (code);


--
-- Name: customer_return_items_customer_return_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_return_items_customer_return_id_idx ON public.customer_return_items USING btree (customer_return_id);


--
-- Name: customer_return_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_return_items_product_id_idx ON public.customer_return_items USING btree (product_id);


--
-- Name: customer_return_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_return_items_product_variation_id_idx ON public.customer_return_items USING btree (product_variation_id);


--
-- Name: customer_returns_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_business_id_idx ON public.customer_returns USING btree (business_id);


--
-- Name: customer_returns_customer_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_customer_id_idx ON public.customer_returns USING btree (customer_id);


--
-- Name: customer_returns_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_location_id_idx ON public.customer_returns USING btree (location_id);


--
-- Name: customer_returns_return_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_return_date_idx ON public.customer_returns USING btree (return_date);


--
-- Name: customer_returns_return_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customer_returns_return_number_key ON public.customer_returns USING btree (return_number);


--
-- Name: customer_returns_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_sale_id_idx ON public.customer_returns USING btree (sale_id);


--
-- Name: customer_returns_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customer_returns_status_idx ON public.customer_returns USING btree (status);


--
-- Name: customers_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customers_business_id_idx ON public.customers USING btree (business_id);


--
-- Name: customers_business_id_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX customers_business_id_name_unique ON public.customers USING btree (business_id, name) WHERE (deleted_at IS NULL);


--
-- Name: debit_notes_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX debit_notes_business_id_idx ON public.debit_notes USING btree (business_id);


--
-- Name: debit_notes_debit_note_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX debit_notes_debit_note_date_idx ON public.debit_notes USING btree (debit_note_date);


--
-- Name: debit_notes_debit_note_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX debit_notes_debit_note_number_key ON public.debit_notes USING btree (debit_note_number);


--
-- Name: debit_notes_purchase_return_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX debit_notes_purchase_return_id_idx ON public.debit_notes USING btree (purchase_return_id);


--
-- Name: debit_notes_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX debit_notes_status_idx ON public.debit_notes USING btree (status);


--
-- Name: debit_notes_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX debit_notes_supplier_id_idx ON public.debit_notes USING btree (supplier_id);


--
-- Name: discount_configs_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX discount_configs_business_id_idx ON public.discount_configs USING btree (business_id);


--
-- Name: discount_configs_discount_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX discount_configs_discount_type_idx ON public.discount_configs USING btree (discount_type);


--
-- Name: freebie_logs_approval_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_approval_status_idx ON public.freebie_logs USING btree (approval_status);


--
-- Name: freebie_logs_approved_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_approved_by_idx ON public.freebie_logs USING btree (approved_by);


--
-- Name: freebie_logs_business_id_location_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_business_id_location_id_created_at_idx ON public.freebie_logs USING btree (business_id, location_id, created_at);


--
-- Name: freebie_logs_requested_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_requested_by_idx ON public.freebie_logs USING btree (requested_by);


--
-- Name: freebie_logs_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_sale_id_idx ON public.freebie_logs USING btree (sale_id);


--
-- Name: freebie_logs_shift_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX freebie_logs_shift_id_idx ON public.freebie_logs USING btree (shift_id);


--
-- Name: inventory_corrections_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_business_id_idx ON public.inventory_corrections USING btree (business_id);


--
-- Name: inventory_corrections_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_created_at_idx ON public.inventory_corrections USING btree (created_at);


--
-- Name: inventory_corrections_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_created_by_idx ON public.inventory_corrections USING btree (created_by);


--
-- Name: inventory_corrections_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_location_id_idx ON public.inventory_corrections USING btree (location_id);


--
-- Name: inventory_corrections_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_product_id_idx ON public.inventory_corrections USING btree (product_id);


--
-- Name: inventory_corrections_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_product_variation_id_idx ON public.inventory_corrections USING btree (product_variation_id);


--
-- Name: inventory_corrections_reason_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_reason_idx ON public.inventory_corrections USING btree (reason);


--
-- Name: inventory_corrections_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_corrections_status_idx ON public.inventory_corrections USING btree (status);


--
-- Name: inventory_corrections_stock_transaction_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX inventory_corrections_stock_transaction_id_key ON public.inventory_corrections USING btree (stock_transaction_id);


--
-- Name: payments_accounts_payable_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_accounts_payable_id_idx ON public.payments USING btree (accounts_payable_id);


--
-- Name: payments_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_business_id_idx ON public.payments USING btree (business_id);


--
-- Name: payments_payment_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_payment_date_idx ON public.payments USING btree (payment_date);


--
-- Name: payments_payment_method_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_payment_method_idx ON public.payments USING btree (payment_method);


--
-- Name: payments_payment_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX payments_payment_number_key ON public.payments USING btree (payment_number);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: payments_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payments_supplier_id_idx ON public.payments USING btree (supplier_id);


--
-- Name: permissions_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name);


--
-- Name: post_dated_cheques_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_dated_cheques_business_id_idx ON public.post_dated_cheques USING btree (business_id);


--
-- Name: post_dated_cheques_cheque_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_dated_cheques_cheque_date_idx ON public.post_dated_cheques USING btree (cheque_date);


--
-- Name: post_dated_cheques_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_dated_cheques_status_idx ON public.post_dated_cheques USING btree (status);


--
-- Name: post_dated_cheques_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_dated_cheques_supplier_id_idx ON public.post_dated_cheques USING btree (supplier_id);


--
-- Name: product_history_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_business_id_idx ON public.product_history USING btree (business_id);


--
-- Name: product_history_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_location_id_idx ON public.product_history USING btree (location_id);


--
-- Name: product_history_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_product_id_idx ON public.product_history USING btree (product_id);


--
-- Name: product_history_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_product_variation_id_idx ON public.product_history USING btree (product_variation_id);


--
-- Name: product_history_reference_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_reference_id_idx ON public.product_history USING btree (reference_id);


--
-- Name: product_history_reference_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_reference_type_idx ON public.product_history USING btree (reference_type);


--
-- Name: product_history_transaction_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_transaction_date_idx ON public.product_history USING btree (transaction_date);


--
-- Name: product_history_transaction_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_history_transaction_type_idx ON public.product_history USING btree (transaction_type);


--
-- Name: product_serial_numbers_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_business_id_idx ON public.product_serial_numbers USING btree (business_id);


--
-- Name: product_serial_numbers_business_id_serialNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "product_serial_numbers_business_id_serialNumber_key" ON public.product_serial_numbers USING btree (business_id, "serialNumber");


--
-- Name: product_serial_numbers_current_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_current_location_id_idx ON public.product_serial_numbers USING btree (current_location_id);


--
-- Name: product_serial_numbers_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_product_id_idx ON public.product_serial_numbers USING btree (product_id);


--
-- Name: product_serial_numbers_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_product_variation_id_idx ON public.product_serial_numbers USING btree (product_variation_id);


--
-- Name: product_serial_numbers_purchase_receipt_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_purchase_receipt_id_idx ON public.product_serial_numbers USING btree (purchase_receipt_id);


--
-- Name: product_serial_numbers_serialNumber_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "product_serial_numbers_serialNumber_idx" ON public.product_serial_numbers USING btree ("serialNumber");


--
-- Name: product_serial_numbers_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_status_idx ON public.product_serial_numbers USING btree (status);


--
-- Name: product_serial_numbers_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_serial_numbers_supplier_id_idx ON public.product_serial_numbers USING btree (supplier_id);


--
-- Name: product_variations_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_variations_business_id_idx ON public.product_variations USING btree (business_id);


--
-- Name: product_variations_business_id_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX product_variations_business_id_sku_key ON public.product_variations USING btree (business_id, sku);


--
-- Name: product_variations_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_variations_product_id_idx ON public.product_variations USING btree (product_id);


--
-- Name: product_variations_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_variations_sku_idx ON public.product_variations USING btree (sku);


--
-- Name: product_variations_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_variations_supplier_id_idx ON public.product_variations USING btree (supplier_id);


--
-- Name: products_brand_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_brand_id_idx ON public.products USING btree (brand_id);


--
-- Name: products_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_business_id_idx ON public.products USING btree (business_id);


--
-- Name: products_business_id_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_business_id_sku_key ON public.products USING btree (business_id, sku);


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: products_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_sku_idx ON public.products USING btree (sku);


--
-- Name: purchase_amendments_amendment_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_amendments_amendment_date_idx ON public.purchase_amendments USING btree (amendment_date);


--
-- Name: purchase_amendments_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_amendments_business_id_idx ON public.purchase_amendments USING btree (business_id);


--
-- Name: purchase_amendments_purchase_id_amendment_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX purchase_amendments_purchase_id_amendment_number_key ON public.purchase_amendments USING btree (purchase_id, amendment_number);


--
-- Name: purchase_amendments_purchase_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_amendments_purchase_id_idx ON public.purchase_amendments USING btree (purchase_id);


--
-- Name: purchase_amendments_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_amendments_status_idx ON public.purchase_amendments USING btree (status);


--
-- Name: purchase_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_items_product_id_idx ON public.purchase_items USING btree (product_id);


--
-- Name: purchase_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_items_product_variation_id_idx ON public.purchase_items USING btree (product_variation_id);


--
-- Name: purchase_items_purchase_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_items_purchase_id_idx ON public.purchase_items USING btree (purchase_id);


--
-- Name: purchase_receipt_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipt_items_product_id_idx ON public.purchase_receipt_items USING btree (product_id);


--
-- Name: purchase_receipt_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipt_items_product_variation_id_idx ON public.purchase_receipt_items USING btree (product_variation_id);


--
-- Name: purchase_receipt_items_purchase_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipt_items_purchase_item_id_idx ON public.purchase_receipt_items USING btree (purchase_item_id);


--
-- Name: purchase_receipt_items_purchase_receipt_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipt_items_purchase_receipt_id_idx ON public.purchase_receipt_items USING btree (purchase_receipt_id);


--
-- Name: purchase_receipts_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_business_id_idx ON public.purchase_receipts USING btree (business_id);


--
-- Name: purchase_receipts_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_location_id_idx ON public.purchase_receipts USING btree (location_id);


--
-- Name: purchase_receipts_purchase_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_purchase_id_idx ON public.purchase_receipts USING btree (purchase_id);


--
-- Name: purchase_receipts_receipt_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_receipt_date_idx ON public.purchase_receipts USING btree (receipt_date);


--
-- Name: purchase_receipts_receipt_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX purchase_receipts_receipt_number_key ON public.purchase_receipts USING btree (receipt_number);


--
-- Name: purchase_receipts_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_status_idx ON public.purchase_receipts USING btree (status);


--
-- Name: purchase_receipts_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_receipts_supplier_id_idx ON public.purchase_receipts USING btree (supplier_id);


--
-- Name: purchase_return_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_return_items_product_id_idx ON public.purchase_return_items USING btree (product_id);


--
-- Name: purchase_return_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_return_items_product_variation_id_idx ON public.purchase_return_items USING btree (product_variation_id);


--
-- Name: purchase_return_items_purchase_receipt_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_return_items_purchase_receipt_item_id_idx ON public.purchase_return_items USING btree (purchase_receipt_item_id);


--
-- Name: purchase_return_items_purchase_return_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_return_items_purchase_return_id_idx ON public.purchase_return_items USING btree (purchase_return_id);


--
-- Name: purchase_returns_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_business_id_idx ON public.purchase_returns USING btree (business_id);


--
-- Name: purchase_returns_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_location_id_idx ON public.purchase_returns USING btree (location_id);


--
-- Name: purchase_returns_purchase_receipt_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_purchase_receipt_id_idx ON public.purchase_returns USING btree (purchase_receipt_id);


--
-- Name: purchase_returns_return_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_return_date_idx ON public.purchase_returns USING btree (return_date);


--
-- Name: purchase_returns_return_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX purchase_returns_return_number_key ON public.purchase_returns USING btree (return_number);


--
-- Name: purchase_returns_return_reason_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_return_reason_idx ON public.purchase_returns USING btree (return_reason);


--
-- Name: purchase_returns_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_status_idx ON public.purchase_returns USING btree (status);


--
-- Name: purchase_returns_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchase_returns_supplier_id_idx ON public.purchase_returns USING btree (supplier_id);


--
-- Name: purchases_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchases_business_id_idx ON public.purchases USING btree (business_id);


--
-- Name: purchases_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchases_location_id_idx ON public.purchases USING btree (location_id);


--
-- Name: purchases_purchase_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchases_purchase_date_idx ON public.purchases USING btree (purchase_date);


--
-- Name: purchases_purchase_order_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX purchases_purchase_order_number_key ON public.purchases USING btree (purchase_order_number);


--
-- Name: purchases_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchases_status_idx ON public.purchases USING btree (status);


--
-- Name: purchases_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX purchases_supplier_id_idx ON public.purchases USING btree (supplier_id);


--
-- Name: qc_checklist_templates_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qc_checklist_templates_business_id_idx ON public.qc_checklist_templates USING btree (business_id);


--
-- Name: quality_control_check_items_check_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_check_items_check_category_idx ON public.quality_control_check_items USING btree (check_category);


--
-- Name: quality_control_check_items_check_result_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_check_items_check_result_idx ON public.quality_control_check_items USING btree (check_result);


--
-- Name: quality_control_check_items_quality_control_inspection_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_check_items_quality_control_inspection_id_idx ON public.quality_control_check_items USING btree (quality_control_inspection_id);


--
-- Name: quality_control_inspections_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_inspections_business_id_idx ON public.quality_control_inspections USING btree (business_id);


--
-- Name: quality_control_inspections_inspection_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_inspections_inspection_date_idx ON public.quality_control_inspections USING btree (inspection_date);


--
-- Name: quality_control_inspections_inspection_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX quality_control_inspections_inspection_number_key ON public.quality_control_inspections USING btree (inspection_number);


--
-- Name: quality_control_inspections_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_inspections_location_id_idx ON public.quality_control_inspections USING btree (location_id);


--
-- Name: quality_control_inspections_purchase_receipt_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_inspections_purchase_receipt_id_idx ON public.quality_control_inspections USING btree (purchase_receipt_id);


--
-- Name: quality_control_inspections_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_inspections_status_idx ON public.quality_control_inspections USING btree (status);


--
-- Name: quality_control_items_inspection_result_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_items_inspection_result_idx ON public.quality_control_items USING btree (inspection_result);


--
-- Name: quality_control_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_items_product_id_idx ON public.quality_control_items USING btree (product_id);


--
-- Name: quality_control_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_items_product_variation_id_idx ON public.quality_control_items USING btree (product_variation_id);


--
-- Name: quality_control_items_quality_control_inspection_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quality_control_items_quality_control_inspection_id_idx ON public.quality_control_items USING btree (quality_control_inspection_id);


--
-- Name: quotation_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotation_items_product_id_idx ON public.quotation_items USING btree (product_id);


--
-- Name: quotation_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotation_items_product_variation_id_idx ON public.quotation_items USING btree (product_variation_id);


--
-- Name: quotation_items_quotation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotation_items_quotation_id_idx ON public.quotation_items USING btree (quotation_id);


--
-- Name: quotations_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_business_id_idx ON public.quotations USING btree (business_id);


--
-- Name: quotations_converted_to_sale_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX quotations_converted_to_sale_id_key ON public.quotations USING btree (converted_to_sale_id);


--
-- Name: quotations_customer_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_customer_id_idx ON public.quotations USING btree (customer_id);


--
-- Name: quotations_expiry_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_expiry_date_idx ON public.quotations USING btree (expiry_date);


--
-- Name: quotations_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_location_id_idx ON public.quotations USING btree (location_id);


--
-- Name: quotations_quotation_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_quotation_date_idx ON public.quotations USING btree (quotation_date);


--
-- Name: quotations_quotation_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX quotations_quotation_number_key ON public.quotations USING btree (quotation_number);


--
-- Name: quotations_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_status_idx ON public.quotations USING btree (status);


--
-- Name: role_locations_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_locations_location_id_idx ON public.role_locations USING btree (location_id);


--
-- Name: role_locations_role_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_locations_role_id_idx ON public.role_locations USING btree (role_id);


--
-- Name: sale_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sale_items_product_id_idx ON public.sale_items USING btree (product_id);


--
-- Name: sale_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sale_items_product_variation_id_idx ON public.sale_items USING btree (product_variation_id);


--
-- Name: sale_items_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sale_items_sale_id_idx ON public.sale_items USING btree (sale_id);


--
-- Name: sale_payments_payment_method_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sale_payments_payment_method_idx ON public.sale_payments USING btree (payment_method);


--
-- Name: sale_payments_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sale_payments_sale_id_idx ON public.sale_payments USING btree (sale_id);


--
-- Name: sales_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_business_id_idx ON public.sales USING btree (business_id);


--
-- Name: sales_customer_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_customer_id_idx ON public.sales USING btree (customer_id);


--
-- Name: sales_discount_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_discount_type_idx ON public.sales USING btree (discount_type);


--
-- Name: sales_invoice_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sales_invoice_number_key ON public.sales USING btree (invoice_number);


--
-- Name: sales_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_location_id_idx ON public.sales USING btree (location_id);


--
-- Name: sales_sale_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_sale_date_idx ON public.sales USING btree (sale_date);


--
-- Name: sales_shift_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_shift_id_idx ON public.sales USING btree (shift_id);


--
-- Name: sales_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sales_status_idx ON public.sales USING btree (status);


--
-- Name: serial_number_movements_moved_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX serial_number_movements_moved_at_idx ON public.serial_number_movements USING btree (moved_at);


--
-- Name: serial_number_movements_movementType_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "serial_number_movements_movementType_idx" ON public.serial_number_movements USING btree ("movementType");


--
-- Name: serial_number_movements_serial_number_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX serial_number_movements_serial_number_id_idx ON public.serial_number_movements USING btree (serial_number_id);


--
-- Name: sessions_session_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX sessions_session_token_key ON public.sessions USING btree (session_token);


--
-- Name: stock_transactions_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_business_id_idx ON public.stock_transactions USING btree (business_id);


--
-- Name: stock_transactions_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_created_at_idx ON public.stock_transactions USING btree (created_at);


--
-- Name: stock_transactions_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_location_id_idx ON public.stock_transactions USING btree (location_id);


--
-- Name: stock_transactions_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_product_id_idx ON public.stock_transactions USING btree (product_id);


--
-- Name: stock_transactions_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_product_variation_id_idx ON public.stock_transactions USING btree (product_variation_id);


--
-- Name: stock_transactions_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transactions_type_idx ON public.stock_transactions USING btree (type);


--
-- Name: stock_transfer_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfer_items_product_id_idx ON public.stock_transfer_items USING btree (product_id);


--
-- Name: stock_transfer_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfer_items_product_variation_id_idx ON public.stock_transfer_items USING btree (product_variation_id);


--
-- Name: stock_transfer_items_stock_transfer_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfer_items_stock_transfer_id_idx ON public.stock_transfer_items USING btree (stock_transfer_id);


--
-- Name: stock_transfers_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfers_business_id_idx ON public.stock_transfers USING btree (business_id);


--
-- Name: stock_transfers_from_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfers_from_location_id_idx ON public.stock_transfers USING btree (from_location_id);


--
-- Name: stock_transfers_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfers_status_idx ON public.stock_transfers USING btree (status);


--
-- Name: stock_transfers_to_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfers_to_location_id_idx ON public.stock_transfers USING btree (to_location_id);


--
-- Name: stock_transfers_transfer_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_transfers_transfer_date_idx ON public.stock_transfers USING btree (transfer_date);


--
-- Name: stock_transfers_transfer_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX stock_transfers_transfer_number_key ON public.stock_transfers USING btree (transfer_number);


--
-- Name: subscriptions_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscriptions_business_id_idx ON public.subscriptions USING btree (business_id);


--
-- Name: supplier_return_items_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_return_items_product_id_idx ON public.supplier_return_items USING btree (product_id);


--
-- Name: supplier_return_items_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_return_items_product_variation_id_idx ON public.supplier_return_items USING btree (product_variation_id);


--
-- Name: supplier_return_items_supplier_return_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_return_items_supplier_return_id_idx ON public.supplier_return_items USING btree (supplier_return_id);


--
-- Name: supplier_returns_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_returns_business_id_idx ON public.supplier_returns USING btree (business_id);


--
-- Name: supplier_returns_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_returns_location_id_idx ON public.supplier_returns USING btree (location_id);


--
-- Name: supplier_returns_return_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_returns_return_date_idx ON public.supplier_returns USING btree (return_date);


--
-- Name: supplier_returns_return_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX supplier_returns_return_number_key ON public.supplier_returns USING btree (return_number);


--
-- Name: supplier_returns_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_returns_status_idx ON public.supplier_returns USING btree (status);


--
-- Name: supplier_returns_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX supplier_returns_supplier_id_idx ON public.supplier_returns USING btree (supplier_id);


--
-- Name: suppliers_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_business_id_idx ON public.suppliers USING btree (business_id);


--
-- Name: tax_rates_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tax_rates_business_id_idx ON public.tax_rates USING btree (business_id);


--
-- Name: units_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX units_business_id_idx ON public.units USING btree (business_id);


--
-- Name: user_locations_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_locations_location_id_idx ON public.user_locations USING btree (location_id);


--
-- Name: user_locations_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_locations_user_id_idx ON public.user_locations USING btree (user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: variation_location_details_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX variation_location_details_location_id_idx ON public.variation_location_details USING btree (location_id);


--
-- Name: variation_location_details_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX variation_location_details_product_id_idx ON public.variation_location_details USING btree (product_id);


--
-- Name: variation_location_details_product_variation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX variation_location_details_product_variation_id_idx ON public.variation_location_details USING btree (product_variation_id);


--
-- Name: variation_location_details_product_variation_id_location_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX variation_location_details_product_variation_id_location_id_key ON public.variation_location_details USING btree (product_variation_id, location_id);


--
-- Name: verification_tokens_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX verification_tokens_token_key ON public.verification_tokens USING btree (token);


--
-- Name: void_transactions_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX void_transactions_business_id_idx ON public.void_transactions USING btree (business_id);


--
-- Name: void_transactions_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX void_transactions_location_id_idx ON public.void_transactions USING btree (location_id);


--
-- Name: void_transactions_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX void_transactions_sale_id_idx ON public.void_transactions USING btree (sale_id);


--
-- Name: void_transactions_voided_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX void_transactions_voided_by_idx ON public.void_transactions USING btree (voided_by);


--
-- Name: warranties_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranties_business_id_idx ON public.warranties USING btree (business_id);


--
-- Name: warranty_claims_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_business_id_idx ON public.warranty_claims USING btree (business_id);


--
-- Name: warranty_claims_claim_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_claim_date_idx ON public.warranty_claims USING btree (claim_date);


--
-- Name: warranty_claims_claim_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX warranty_claims_claim_number_key ON public.warranty_claims USING btree (claim_number);


--
-- Name: warranty_claims_claim_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_claim_type_idx ON public.warranty_claims USING btree (claim_type);


--
-- Name: warranty_claims_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_location_id_idx ON public.warranty_claims USING btree (location_id);


--
-- Name: warranty_claims_sale_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_sale_id_idx ON public.warranty_claims USING btree (sale_id);


--
-- Name: warranty_claims_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX warranty_claims_status_idx ON public.warranty_claims USING btree (status);


--
-- Name: _AccountsPayableToPurchaseReturn _AccountsPayableToPurchaseReturn_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_AccountsPayableToPurchaseReturn"
    ADD CONSTRAINT "_AccountsPayableToPurchaseReturn_A_fkey" FOREIGN KEY ("A") REFERENCES public.accounts_payable(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AccountsPayableToPurchaseReturn _AccountsPayableToPurchaseReturn_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_AccountsPayableToPurchaseReturn"
    ADD CONSTRAINT "_AccountsPayableToPurchaseReturn_B_fkey" FOREIGN KEY ("B") REFERENCES public.purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: accounts_payable accounts_payable_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts_payable
    ADD CONSTRAINT accounts_payable_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: accounts_payable accounts_payable_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts_payable
    ADD CONSTRAINT accounts_payable_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_transactions bank_transactions_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: business business_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: business_locations business_locations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_locations
    ADD CONSTRAINT business_locations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: business business_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cash_denominations cash_denominations_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_denominations
    ADD CONSTRAINT cash_denominations_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.cashier_shifts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cash_in_out cash_in_out_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_in_out
    ADD CONSTRAINT cash_in_out_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.cashier_shifts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: combo_products combo_products_child_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.combo_products
    ADD CONSTRAINT combo_products_child_product_id_fkey FOREIGN KEY (child_product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: combo_products combo_products_parent_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.combo_products
    ADD CONSTRAINT combo_products_parent_product_id_fkey FOREIGN KEY (parent_product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customer_return_items customer_return_items_customer_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_return_items
    ADD CONSTRAINT customer_return_items_customer_return_id_fkey FOREIGN KEY (customer_return_id) REFERENCES public.customer_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: customer_returns customer_returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_returns
    ADD CONSTRAINT customer_returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_returns customer_returns_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_returns
    ADD CONSTRAINT customer_returns_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: debit_notes debit_notes_purchase_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_purchase_return_id_fkey FOREIGN KEY (purchase_return_id) REFERENCES public.purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: debit_notes debit_notes_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: freebie_logs freebie_logs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: freebie_logs freebie_logs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: freebie_logs freebie_logs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: freebie_logs freebie_logs_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: freebie_logs freebie_logs_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.cashier_shifts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: freebie_logs freebie_logs_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freebie_logs
    ADD CONSTRAINT freebie_logs_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_corrections inventory_corrections_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_corrections inventory_corrections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_corrections inventory_corrections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_corrections inventory_corrections_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_corrections inventory_corrections_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_corrections inventory_corrections_product_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_corrections inventory_corrections_stock_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_corrections
    ADD CONSTRAINT inventory_corrections_stock_transaction_id_fkey FOREIGN KEY (stock_transaction_id) REFERENCES public.stock_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_accounts_payable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_accounts_payable_id_fkey FOREIGN KEY (accounts_payable_id) REFERENCES public.accounts_payable(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_post_dated_cheque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_post_dated_cheque_id_fkey FOREIGN KEY (post_dated_cheque_id) REFERENCES public.post_dated_cheques(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: post_dated_cheques post_dated_cheques_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_dated_cheques
    ADD CONSTRAINT post_dated_cheques_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_serial_numbers product_serial_numbers_current_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_current_location_id_fkey FOREIGN KEY (current_location_id) REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_serial_numbers product_serial_numbers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_serial_numbers product_serial_numbers_product_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_serial_numbers product_serial_numbers_purchase_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_purchase_receipt_id_fkey FOREIGN KEY (purchase_receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_serial_numbers product_serial_numbers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_serial_numbers
    ADD CONSTRAINT product_serial_numbers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_variations product_variations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variations product_variations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variations product_variations_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_variations product_variations_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_tax_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tax_id_fkey FOREIGN KEY (tax_id) REFERENCES public.tax_rates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_amendments purchase_amendments_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_amendments
    ADD CONSTRAINT purchase_amendments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_items purchase_items_product_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_purchase_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_purchase_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_purchase_receipt_id_fkey FOREIGN KEY (purchase_receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_receipts purchase_receipts_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_receipts purchase_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_return_items purchase_return_items_purchase_receipt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_purchase_receipt_item_id_fkey FOREIGN KEY (purchase_receipt_item_id) REFERENCES public.purchase_receipt_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_return_items purchase_return_items_purchase_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_purchase_return_id_fkey FOREIGN KEY (purchase_return_id) REFERENCES public.purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_purchase_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_purchase_receipt_id_fkey FOREIGN KEY (purchase_receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_returns purchase_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quality_control_check_items quality_control_check_items_quality_control_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_check_items
    ADD CONSTRAINT quality_control_check_items_quality_control_inspection_id_fkey FOREIGN KEY (quality_control_inspection_id) REFERENCES public.quality_control_inspections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quality_control_inspections quality_control_inspections_purchase_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_inspections
    ADD CONSTRAINT quality_control_inspections_purchase_receipt_id_fkey FOREIGN KEY (purchase_receipt_id) REFERENCES public.purchase_receipts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quality_control_items quality_control_items_quality_control_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_control_items
    ADD CONSTRAINT quality_control_items_quality_control_inspection_id_fkey FOREIGN KEY (quality_control_inspection_id) REFERENCES public.quality_control_inspections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotation_items quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: role_locations role_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_locations
    ADD CONSTRAINT role_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_locations role_locations_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_locations
    ADD CONSTRAINT role_locations_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: roles roles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_payments sale_payments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.cashier_shifts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: serial_number_movements serial_number_movements_serial_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.serial_number_movements
    ADD CONSTRAINT serial_number_movements_serial_number_id_fkey FOREIGN KEY (serial_number_id) REFERENCES public.product_serial_numbers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_transactions stock_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_transactions stock_transactions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_transactions stock_transactions_product_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transactions
    ADD CONSTRAINT stock_transactions_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_transfer_items stock_transfer_items_stock_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id) REFERENCES public.stock_transfers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return_items supplier_return_items_supplier_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT supplier_return_items_supplier_return_id_fkey FOREIGN KEY (supplier_return_id) REFERENCES public.supplier_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_returns supplier_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_locations user_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_locations user_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variation_location_details variation_location_details_opening_stock_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variation_location_details
    ADD CONSTRAINT variation_location_details_opening_stock_set_by_fkey FOREIGN KEY (opening_stock_set_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: variation_location_details variation_location_details_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variation_location_details
    ADD CONSTRAINT variation_location_details_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variation_location_details variation_location_details_product_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variation_location_details
    ADD CONSTRAINT variation_location_details_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: void_transactions void_transactions_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_transactions
    ADD CONSTRAINT void_transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warranty_claims warranty_claims_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_claims
    ADD CONSTRAINT warranty_claims_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict fztTaQ00XdPNyhhhLsmz1Orxb4z9Hu3dpOrWultLDJqkjUPiRGKRo6iz2FgSueA

