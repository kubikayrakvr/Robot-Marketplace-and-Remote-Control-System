--
-- PostgreSQL database dump
--

\restrict XGRuWEm0G0OhsXf2GcYqc8UtpZ4nQRE3WsWJXyXwiqidhc3hDE0scgKhi9gsKD4

-- Dumped from database version 17.9 (Debian 17.9-1.pgdg13+1)
-- Dumped by pg_dump version 17.9 (Debian 17.9-1.pgdg13+1)

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
-- Name: orderstatus; Type: TYPE; Schema: public; Owner: user
--

CREATE TYPE public.orderstatus AS ENUM (
    'PENDING',
    'PAID',
    'SHIPPED',
    'CANCELLED'
);


ALTER TYPE public.orderstatus OWNER TO "user";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying NOT NULL,
    ip_address character varying,
    details json,
    "timestamp" timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO "user";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO "user";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cart_items OWNER TO "user";

--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cart_items_id_seq OWNER TO "user";

--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL
);


ALTER TABLE public.order_items OWNER TO "user";

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO "user";

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status public.orderstatus NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.orders OWNER TO "user";

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO "user";

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: robot_catalog; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.robot_catalog (
    id integer NOT NULL,
    name character varying NOT NULL,
    type character varying,
    price double precision NOT NULL,
    description character varying,
    stock_count integer,
    is_available boolean,
    warranty_months integer,
    ros_namespace character varying
);


ALTER TABLE public.robot_catalog OWNER TO "user";

--
-- Name: robot_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.robot_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.robot_catalog_id_seq OWNER TO "user";

--
-- Name: robot_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.robot_catalog_id_seq OWNED BY public.robot_catalog.id;


--
-- Name: robot_inventory; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.robot_inventory (
    id integer NOT NULL,
    catalog_id integer NOT NULL,
    serial_number character varying NOT NULL,
    activation_code character varying NOT NULL,
    is_activated boolean NOT NULL,
    last_x double precision,
    last_y double precision
);


ALTER TABLE public.robot_inventory OWNER TO "user";

--
-- Name: robot_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.robot_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.robot_inventory_id_seq OWNER TO "user";

--
-- Name: robot_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.robot_inventory_id_seq OWNED BY public.robot_inventory.id;


--
-- Name: user_reports_issue; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.user_reports_issue (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying NOT NULL,
    description character varying NOT NULL,
    is_resolved boolean,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);


ALTER TABLE public.user_reports_issue OWNER TO "user";

--
-- Name: user_reports_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.user_reports_issue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_reports_issue_id_seq OWNER TO "user";

--
-- Name: user_reports_issue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.user_reports_issue_id_seq OWNED BY public.user_reports_issue.id;


--
-- Name: user_robots; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.user_robots (
    id integer NOT NULL,
    user_id integer NOT NULL,
    inventory_id integer NOT NULL,
    nickname character varying,
    activated_at timestamp with time zone DEFAULT now(),
    last_x double precision,
    last_y double precision,
    last_theta double precision,
    last_battery_pct double precision
);


ALTER TABLE public.user_robots OWNER TO "user";

--
-- Name: user_robots_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.user_robots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_robots_id_seq OWNER TO "user";

--
-- Name: user_robots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.user_robots_id_seq OWNED BY public.user_robots.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying NOT NULL,
    security_question character varying,
    security_answer character varying,
    is_active boolean,
    is_admin boolean,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO "user";

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO "user";

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: robot_catalog id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.robot_catalog ALTER COLUMN id SET DEFAULT nextval('public.robot_catalog_id_seq'::regclass);


--
-- Name: robot_inventory id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.robot_inventory ALTER COLUMN id SET DEFAULT nextval('public.robot_inventory_id_seq'::regclass);


--
-- Name: user_reports_issue id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_reports_issue ALTER COLUMN id SET DEFAULT nextval('public.user_reports_issue_id_seq'::regclass);


--
-- Name: user_robots id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_robots ALTER COLUMN id SET DEFAULT nextval('public.user_robots_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: robot_catalog robot_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.robot_catalog
    ADD CONSTRAINT robot_catalog_pkey PRIMARY KEY (id);


--
-- Name: robot_inventory robot_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.robot_inventory
    ADD CONSTRAINT robot_inventory_pkey PRIMARY KEY (id);


--
-- Name: user_reports_issue user_reports_issue_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_reports_issue
    ADD CONSTRAINT user_reports_issue_pkey PRIMARY KEY (id);


--
-- Name: user_robots user_robots_inventory_id_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_robots
    ADD CONSTRAINT user_robots_inventory_id_key UNIQUE (inventory_id);


--
-- Name: user_robots user_robots_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_robots
    ADD CONSTRAINT user_robots_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_audit_logs_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_audit_logs_id ON public.audit_logs USING btree (id);


--
-- Name: ix_cart_items_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_cart_items_id ON public.cart_items USING btree (id);


--
-- Name: ix_order_items_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_order_items_id ON public.order_items USING btree (id);


--
-- Name: ix_orders_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_orders_id ON public.orders USING btree (id);


--
-- Name: ix_robot_catalog_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_robot_catalog_id ON public.robot_catalog USING btree (id);


--
-- Name: ix_robot_inventory_activation_code; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX ix_robot_inventory_activation_code ON public.robot_inventory USING btree (activation_code);


--
-- Name: ix_robot_inventory_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_robot_inventory_id ON public.robot_inventory USING btree (id);


--
-- Name: ix_robot_inventory_serial_number; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX ix_robot_inventory_serial_number ON public.robot_inventory USING btree (serial_number);


--
-- Name: ix_user_reports_issue_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_user_reports_issue_id ON public.user_reports_issue USING btree (id);


--
-- Name: ix_user_robots_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_user_robots_id ON public.user_robots USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.robot_catalog(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.robot_catalog(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: robot_inventory robot_inventory_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.robot_inventory
    ADD CONSTRAINT robot_inventory_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.robot_catalog(id);


--
-- Name: user_reports_issue user_reports_issue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_reports_issue
    ADD CONSTRAINT user_reports_issue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_robots user_robots_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_robots
    ADD CONSTRAINT user_robots_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.robot_inventory(id);


--
-- Name: user_robots user_robots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_robots
    ADD CONSTRAINT user_robots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict XGRuWEm0G0OhsXf2GcYqc8UtpZ4nQRE3WsWJXyXwiqidhc3hDE0scgKhi9gsKD4

