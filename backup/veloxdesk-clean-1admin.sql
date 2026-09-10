--
-- PostgreSQL database dump
--

\restrict gJSg3J2sECoLd2jZkCuLvMulQGlRdcJAveyV1H9pjA67WiK88i23745vAYyCHoQ

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: automation_rules_trigger_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.automation_rules_trigger_enum AS ENUM (
    'ticket_created',
    'status_changed',
    'priority_changed',
    'client_replied',
    'sla_breached'
);


ALTER TYPE public.automation_rules_trigger_enum OWNER TO veloxdesk;

--
-- Name: custom_field_definitions_field_type_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.custom_field_definitions_field_type_enum AS ENUM (
    'text',
    'number',
    'date',
    'select',
    'textarea',
    'checkbox',
    'file',
    'regex'
);


ALTER TYPE public.custom_field_definitions_field_type_enum OWNER TO veloxdesk;

--
-- Name: knowledge_articles_status_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.knowledge_articles_status_enum AS ENUM (
    'draft',
    'published'
);


ALTER TYPE public.knowledge_articles_status_enum OWNER TO veloxdesk;

--
-- Name: ldap_configs_audience_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.ldap_configs_audience_enum AS ENUM (
    'staff',
    'client'
);


ALTER TYPE public.ldap_configs_audience_enum OWNER TO veloxdesk;

--
-- Name: ldap_configs_default_role_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.ldap_configs_default_role_enum AS ENUM (
    'client',
    'operator',
    'admin'
);


ALTER TYPE public.ldap_configs_default_role_enum OWNER TO veloxdesk;

--
-- Name: notifications_channel_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.notifications_channel_enum AS ENUM (
    'email',
    'push',
    'websocket'
);


ALTER TYPE public.notifications_channel_enum OWNER TO veloxdesk;

--
-- Name: notifications_type_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.notifications_type_enum AS ENUM (
    'new_ticket',
    'reply',
    'sla_breach',
    'assignment',
    'status_update',
    'mention'
);


ALTER TYPE public.notifications_type_enum OWNER TO veloxdesk;

--
-- Name: oidc_configs_audience_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.oidc_configs_audience_enum AS ENUM (
    'staff',
    'client'
);


ALTER TYPE public.oidc_configs_audience_enum OWNER TO veloxdesk;

--
-- Name: oidc_configs_default_role_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.oidc_configs_default_role_enum AS ENUM (
    'client',
    'operator',
    'admin'
);


ALTER TYPE public.oidc_configs_default_role_enum OWNER TO veloxdesk;

--
-- Name: saved_reports_group_by_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.saved_reports_group_by_enum AS ENUM (
    'assignee',
    'client',
    'team',
    'status',
    'priority',
    'type',
    'tag',
    'sla_policy',
    'period',
    'company',
    'channel',
    'category'
);


ALTER TYPE public.saved_reports_group_by_enum OWNER TO veloxdesk;

--
-- Name: settings_audit_log_event_type_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.settings_audit_log_event_type_enum AS ENUM (
    'created',
    'updated',
    'deleted'
);


ALTER TYPE public.settings_audit_log_event_type_enum OWNER TO veloxdesk;

--
-- Name: settings_audit_log_module_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.settings_audit_log_module_enum AS ENUM (
    'sla_policy',
    'permission_group',
    'custom_field',
    'automation_rule',
    'ldap_config',
    'oidc_config'
);


ALTER TYPE public.settings_audit_log_module_enum OWNER TO veloxdesk;

--
-- Name: sla_policies_priority_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.sla_policies_priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.sla_policies_priority_enum OWNER TO veloxdesk;

--
-- Name: ticket_activities_type_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.ticket_activities_type_enum AS ENUM (
    'created',
    'status_changed',
    'priority_changed',
    'assigned',
    'unassigned',
    'edited',
    'attachment_added',
    'sla_response_breached',
    'sla_resolution_breached',
    'tag_added',
    'tag_removed',
    'merged_into',
    'deleted',
    'restored',
    'status_email_sent',
    'message_edited',
    'csat_submitted',
    'merged_from'
);


ALTER TYPE public.ticket_activities_type_enum OWNER TO veloxdesk;

--
-- Name: tickets_channel_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.tickets_channel_enum AS ENUM (
    'portal',
    'email',
    'telegram'
);


ALTER TYPE public.tickets_channel_enum OWNER TO veloxdesk;

--
-- Name: tickets_priority_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.tickets_priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.tickets_priority_enum OWNER TO veloxdesk;

--
-- Name: users_auth_provider_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.users_auth_provider_enum AS ENUM (
    'local',
    'ldap',
    'oidc'
);


ALTER TYPE public.users_auth_provider_enum OWNER TO veloxdesk;

--
-- Name: users_locale_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.users_locale_enum AS ENUM (
    'ru',
    'uk',
    'en'
);


ALTER TYPE public.users_locale_enum OWNER TO veloxdesk;

--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: veloxdesk
--

CREATE TYPE public.users_role_enum AS ENUM (
    'client',
    'operator',
    'admin'
);


ALTER TYPE public.users_role_enum OWNER TO veloxdesk;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    file_url character varying(2048) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    uploader_id uuid,
    comment_id uuid
);


ALTER TABLE public.attachments OWNER TO veloxdesk;

--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    trigger public.automation_rules_trigger_enum NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.automation_rules OWNER TO veloxdesk;

--
-- Name: cities; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.cities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cities OWNER TO veloxdesk;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone
);


ALTER TABLE public.comments OWNER TO veloxdesk;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.companies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.companies OWNER TO veloxdesk;

--
-- Name: csat_answers; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.csat_answers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    survey_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    question_id uuid,
    question_text character varying(255) NOT NULL,
    score integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.csat_answers OWNER TO veloxdesk;

--
-- Name: csat_questions; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.csat_questions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    text character varying(255) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.csat_questions OWNER TO veloxdesk;

--
-- Name: csat_surveys; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.csat_surveys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.csat_surveys OWNER TO veloxdesk;

--
-- Name: custom_field_definitions; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.custom_field_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    label character varying(255) NOT NULL,
    field_type public.custom_field_definitions_field_type_enum NOT NULL,
    options jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pattern character varying(500),
    depends_on_field_id uuid,
    condition_value character varying(255),
    options_by_parent jsonb,
    label_uk character varying(255),
    label_en character varying(255)
);


ALTER TABLE public.custom_field_definitions OWNER TO veloxdesk;

--
-- Name: employee_status_history; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.employee_status_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    status_name text NOT NULL,
    status_color character varying(7),
    automatic boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_status_history OWNER TO veloxdesk;

--
-- Name: employee_statuses; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.employee_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    color character varying(7) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name_uk character varying(255),
    name_en character varying(255)
);


ALTER TABLE public.employee_statuses OWNER TO veloxdesk;

--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.knowledge_articles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    status public.knowledge_articles_status_enum DEFAULT 'draft'::public.knowledge_articles_status_enum NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    not_helpful_count integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    title_uk character varying(255),
    title_en character varying(255)
);


ALTER TABLE public.knowledge_articles OWNER TO veloxdesk;

--
-- Name: knowledge_theme; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.knowledge_theme (
    id smallint NOT NULL,
    custom_css text,
    custom_js text
);


ALTER TABLE public.knowledge_theme OWNER TO veloxdesk;

--
-- Name: ldap_configs; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ldap_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audience public.ldap_configs_audience_enum NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    url character varying(255) NOT NULL,
    bind_dn character varying(255) NOT NULL,
    bind_password_encrypted character varying(512),
    search_base character varying(255) NOT NULL,
    user_filter_template character varying(512) DEFAULT '(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})(mail={{username}})))'::character varying NOT NULL,
    email_attribute character varying(100) DEFAULT 'mail'::character varying NOT NULL,
    full_name_attribute character varying(100) DEFAULT 'displayName'::character varying NOT NULL,
    external_id_attribute character varying(100) DEFAULT 'objectGUID'::character varying NOT NULL,
    tls_reject_unauthorized boolean DEFAULT true NOT NULL,
    default_role public.ldap_configs_default_role_enum NOT NULL,
    last_test_success_at timestamp with time zone,
    last_test_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ldap_configs OWNER TO veloxdesk;

--
-- Name: macros; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.macros (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title_uk character varying(255),
    title_en character varying(255)
);


ALTER TABLE public.macros OWNER TO veloxdesk;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO veloxdesk;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: veloxdesk
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO veloxdesk;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: veloxdesk
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type public.notifications_type_enum NOT NULL,
    channel public.notifications_channel_enum NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    ticket_id uuid
);


ALTER TABLE public.notifications OWNER TO veloxdesk;

--
-- Name: oidc_configs; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.oidc_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audience public.oidc_configs_audience_enum NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    issuer_url character varying(500) NOT NULL,
    client_id character varying(255) NOT NULL,
    client_secret_encrypted character varying(512),
    redirect_uri character varying(500) NOT NULL,
    scopes character varying(255) DEFAULT 'openid profile email'::character varying NOT NULL,
    email_claim character varying(100) DEFAULT 'email'::character varying NOT NULL,
    full_name_claim character varying(100) DEFAULT 'name'::character varying NOT NULL,
    default_role public.oidc_configs_default_role_enum NOT NULL,
    last_test_success_at timestamp with time zone,
    last_test_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.oidc_configs OWNER TO veloxdesk;

--
-- Name: permission_group_departments; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.permission_group_departments (
    permission_group_id uuid NOT NULL,
    team_id uuid NOT NULL
);


ALTER TABLE public.permission_group_departments OWNER TO veloxdesk;

--
-- Name: permission_groups; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.permission_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    restrict_to_departments boolean DEFAULT false NOT NULL,
    restrict_to_own_tickets boolean DEFAULT false NOT NULL,
    cannot_be_assignee boolean DEFAULT false NOT NULL,
    require_two_factor boolean DEFAULT false NOT NULL,
    ip_whitelist text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permission_groups OWNER TO veloxdesk;

--
-- Name: presence_settings; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.presence_settings (
    id smallint NOT NULL,
    inactivity_timeout_minutes integer DEFAULT 15 NOT NULL
);


ALTER TABLE public.presence_settings OWNER TO veloxdesk;

--
-- Name: saved_reports; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.saved_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    group_by public.saved_reports_group_by_enum NOT NULL,
    filters jsonb NOT NULL,
    columns jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.saved_reports OWNER TO veloxdesk;

--
-- Name: settings_audit_log; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.settings_audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actor_id uuid,
    module public.settings_audit_log_module_enum NOT NULL,
    event_type public.settings_audit_log_event_type_enum NOT NULL,
    entity_id uuid,
    entity_label character varying(255) NOT NULL,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settings_audit_log OWNER TO veloxdesk;

--
-- Name: sla_policies; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.sla_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    response_time_min integer NOT NULL,
    resolution_time_min integer NOT NULL,
    priority public.sla_policies_priority_enum NOT NULL
);


ALTER TABLE public.sla_policies OWNER TO veloxdesk;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_uk character varying(100),
    name_en character varying(100)
);


ALTER TABLE public.tags OWNER TO veloxdesk;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.team_members OWNER TO veloxdesk;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_uk character varying(255),
    name_en character varying(255)
);


ALTER TABLE public.teams OWNER TO veloxdesk;

--
-- Name: ticket_activities; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    actor_id uuid,
    type public.ticket_activities_type_enum NOT NULL,
    from_value text,
    to_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    field character varying(50)
);


ALTER TABLE public.ticket_activities OWNER TO veloxdesk;

--
-- Name: ticket_categories; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_uk character varying(100),
    name_en character varying(100)
);


ALTER TABLE public.ticket_categories OWNER TO veloxdesk;

--
-- Name: ticket_custom_field_values; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_custom_field_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    field_id uuid NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.ticket_custom_field_values OWNER TO veloxdesk;

--
-- Name: ticket_mentions; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_mentions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mentioned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_mentions OWNER TO veloxdesk;

--
-- Name: ticket_statuses; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(20),
    name character varying(255) NOT NULL,
    color character varying(7) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    tracks_sla boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name_uk character varying(255),
    name_en character varying(255)
);


ALTER TABLE public.ticket_statuses OWNER TO veloxdesk;

--
-- Name: ticket_tags; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.ticket_tags OWNER TO veloxdesk;

--
-- Name: ticket_types; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(20),
    name character varying(255) NOT NULL,
    name_uk character varying(255),
    name_en character varying(255),
    color character varying(7) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_types OWNER TO veloxdesk;

--
-- Name: ticket_watchers; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.ticket_watchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_watchers OWNER TO veloxdesk;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    priority public.tickets_priority_enum DEFAULT 'medium'::public.tickets_priority_enum NOT NULL,
    created_by uuid NOT NULL,
    assigned_to uuid,
    team_id uuid,
    sla_policy_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    external_thread_id text,
    ticket_number integer NOT NULL,
    merged_into_id uuid,
    created_on_behalf_by uuid,
    category_id uuid,
    channel public.tickets_channel_enum DEFAULT 'portal'::public.tickets_channel_enum NOT NULL,
    status_id uuid NOT NULL,
    type_id uuid NOT NULL
);


ALTER TABLE public.tickets OWNER TO veloxdesk;

--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: veloxdesk
--

CREATE SEQUENCE public.tickets_ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_ticket_number_seq OWNER TO veloxdesk;

--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: veloxdesk
--

ALTER SEQUENCE public.tickets_ticket_number_seq OWNED BY public.tickets.ticket_number;


--
-- Name: user_extra_departments; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.user_extra_departments (
    user_id uuid NOT NULL,
    team_id uuid NOT NULL
);


ALTER TABLE public.user_extra_departments OWNER TO veloxdesk;

--
-- Name: users; Type: TABLE; Schema: public; Owner: veloxdesk
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    full_name character varying(255) NOT NULL,
    role public.users_role_enum DEFAULT 'client'::public.users_role_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    refresh_token_hash character varying(255),
    computer_name character varying(255),
    "position" character varying(255),
    department character varying(255),
    company character varying(255),
    phone character varying(50),
    city character varying(255),
    permission_group_id uuid,
    totp_secret_encrypted character varying(512),
    two_factor_enabled boolean DEFAULT false NOT NULL,
    current_status_id uuid,
    locale public.users_locale_enum DEFAULT 'ru'::public.users_locale_enum NOT NULL,
    merged_into_id uuid,
    approved_at timestamp with time zone,
    cannot_manage_admins boolean DEFAULT false NOT NULL,
    profile_completed_at timestamp with time zone,
    is_vip boolean DEFAULT false NOT NULL,
    telegram_chat_id text,
    telegram_link_token text,
    telegram_link_token_expires_at timestamp with time zone,
    telegram_pending_new_ticket boolean DEFAULT false NOT NULL,
    telegram_csat_draft text,
    telegram_pending_reply_to_ticket_id uuid,
    auth_provider public.users_auth_provider_enum DEFAULT 'local'::public.users_auth_provider_enum NOT NULL,
    external_id character varying(255)
);


ALTER TABLE public.users OWNER TO veloxdesk;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: tickets ticket_number; Type: DEFAULT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets ALTER COLUMN ticket_number SET DEFAULT nextval('public.tickets_ticket_number_seq'::regclass);


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.attachments (id, ticket_id, file_url, file_name, file_size, created_at, uploader_id, comment_id) FROM stdin;
\.


--
-- Data for Name: automation_rules; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.automation_rules (id, name, trigger, conditions, actions, is_enabled, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.cities (id, name, created_at) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.comments (id, ticket_id, author_id, body, is_internal, created_at, edited_at) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.companies (id, name, created_at) FROM stdin;
\.


--
-- Data for Name: csat_answers; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.csat_answers (id, survey_id, ticket_id, question_id, question_text, score, created_at) FROM stdin;
\.


--
-- Data for Name: csat_questions; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.csat_questions (id, text, is_enabled, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: csat_surveys; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.csat_surveys (id, ticket_id, submitted_at, created_at) FROM stdin;
\.


--
-- Data for Name: custom_field_definitions; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.custom_field_definitions (id, label, field_type, options, created_at, pattern, depends_on_field_id, condition_value, options_by_parent, label_uk, label_en) FROM stdin;
\.


--
-- Data for Name: employee_status_history; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.employee_status_history (id, user_id, status_name, status_color, automatic, created_at) FROM stdin;
\.


--
-- Data for Name: employee_statuses; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.employee_statuses (id, name, color, created_at, updated_at, name_uk, name_en) FROM stdin;
\.


--
-- Data for Name: knowledge_articles; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.knowledge_articles (id, title, content, author_id, status, published_at, created_at, updated_at, view_count, helpful_count, not_helpful_count, is_public, title_uk, title_en) FROM stdin;
\.


--
-- Data for Name: knowledge_theme; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.knowledge_theme (id, custom_css, custom_js) FROM stdin;
\.


--
-- Data for Name: ldap_configs; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ldap_configs (id, audience, enabled, url, bind_dn, bind_password_encrypted, search_base, user_filter_template, email_attribute, full_name_attribute, external_id_attribute, tls_reject_unauthorized, default_role, last_test_success_at, last_test_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: macros; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.macros (id, title, body, created_at, title_uk, title_en) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1783859964698	InitSchema1783859964698
2	1783861221714	AddUserRefreshTokenHash1783861221714
3	1783867942970	AddMissingIndexesAndTimestamptz1783867942970
4	1783869352840	AddTicketActivities1783869352840
5	1783870971961	AddTicketExternalThreadId1783870971961
6	1783872400000	AddAttachmentAddedActivityType1783872400000
7	1783880000000	AddSlaBreachActivityTypes1783880000000
8	1783990000000	AddCommentEditedAt1783990000000
9	1784000000000	AddTicketNumber1784000000000
10	1784010000000	AddMacros1784010000000
11	1784020000000	AddCustomFields1784020000000
12	1784030000000	AddAutomationRules1784030000000
13	1784040000000	AddTicketTypeMergeTagsWatchers1784040000000
14	1784050000000	AddTicketLifecycleActivityTypes1784050000000
15	1784060000000	AddAttachmentUploader1784060000000
16	1784070000000	AddAttachmentComment1784070000000
17	1784080000000	AddUserProfileFields1784080000000
18	1784090000000	AddUserCity1784090000000
19	1784100000000	AddTicketCreatedOnBehalfBy1784100000000
20	1784240000000	AddSavedReports1784240000000
21	1784250000000	AddPermissionGroups1784250000000
22	1784260000000	AddEmployeeStatuses1784260000000
23	1784270000000	AddSlaPolicyPriorityUnique1784270000000
24	1784280000000	AddUserLocale1784280000000
25	1784290000000	AddTicketActivityFieldAndMessageEdited1784290000000
26	1784300000000	AddReportGroupByDimensions1784300000000
27	1784310000000	AddCsat1784310000000
28	1784320000000	AddNotificationTicketIdAndMention1784320000000
29	1784330000000	RenameUserSubdivisionToCompany1784330000000
30	1784340000000	AddTicketTypeWeights1784340000000
31	1784350000000	AddReportGroupByCompany1784350000000
32	1784360000000	AddSettingsAuditLog1784360000000
33	1784370000000	AddCustomFieldTypesAndDependencies1784370000000
34	1784380000000	AddUserMergedIntoId1784380000000
35	1784390000000	AddKnowledgeStatsAndTheme1784390000000
36	1784400000000	AddUserApprovedAt1784400000000
37	1784410000000	AddCreatedAtIndexes1784410000000
38	1784420000000	DropNewTicketStatus1784420000000
39	1784430000000	AddCannotManageAdmins1784430000000
40	1784440000000	AddUserProfileCompletedAt1784440000000
41	1784450000000	AddUserIsVip1784450000000
42	1786176155000	AddSystemUser1786176155000
43	1786196952000	AddPerfIndexes1786196952000
44	1786300000000	AddTicketCategories1786300000000
45	1786400000000	AddCompaniesAndCities1786400000000
46	1786500000000	AddTelegramChannel1786500000000
47	1786600000000	AddTelegramLinkToken1786600000000
48	1786700000000	AddTelegramPendingNewTicket1786700000000
49	1786800000000	AddTelegramCsatDraft1786800000000
50	1786900000000	AddReportGroupByChannel1786900000000
51	1787000000000	AddTelegramPendingReplyToTicket1787000000000
52	1787100000000	AddArticleIsPublic1787100000000
53	1787200000000	AddTicketStatuses1787200000000
54	1787300000000	AddMergedFromActivityType1787300000000
55	1787400000000	AddTicketMentions1787400000000
56	1787500000000	AddCatalogLocaleVariants1787500000000
57	1787600000000	AddPermissionGroupIdIndex1787600000000
58	1787700000000	AddUserDirectoryAuth1787700000000
59	1787800000000	AddLdapAndOidcConfigs1787800000000
60	1787900000000	AddDirectoryAuthSettingsAuditModules1787900000000
61	1788000000000	AddTicketTypes1788000000000
62	1788100000000	AddReportGroupByCategory1788100000000
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.notifications (id, user_id, type, channel, is_read, sent_at, ticket_id) FROM stdin;
\.


--
-- Data for Name: oidc_configs; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.oidc_configs (id, audience, enabled, issuer_url, client_id, client_secret_encrypted, redirect_uri, scopes, email_claim, full_name_claim, default_role, last_test_success_at, last_test_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permission_group_departments; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.permission_group_departments (permission_group_id, team_id) FROM stdin;
\.


--
-- Data for Name: permission_groups; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.permission_groups (id, name, restrict_to_departments, restrict_to_own_tickets, cannot_be_assignee, require_two_factor, ip_whitelist, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: presence_settings; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.presence_settings (id, inactivity_timeout_minutes) FROM stdin;
\.


--
-- Data for Name: saved_reports; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.saved_reports (id, name, group_by, filters, columns, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settings_audit_log; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.settings_audit_log (id, actor_id, module, event_type, entity_id, entity_label, changes, created_at) FROM stdin;
\.


--
-- Data for Name: sla_policies; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.sla_policies (id, name, response_time_min, resolution_time_min, priority) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.tags (id, name, created_at, name_uk, name_en) FROM stdin;
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.team_members (team_id, user_id, joined_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.teams (id, name, created_at, name_uk, name_en) FROM stdin;
\.


--
-- Data for Name: ticket_activities; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_activities (id, ticket_id, actor_id, type, from_value, to_value, created_at, field) FROM stdin;
\.


--
-- Data for Name: ticket_categories; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_categories (id, name, created_at, name_uk, name_en) FROM stdin;
\.


--
-- Data for Name: ticket_custom_field_values; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_custom_field_values (id, ticket_id, field_id, value) FROM stdin;
\.


--
-- Data for Name: ticket_mentions; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_mentions (id, ticket_id, user_id, mentioned_at) FROM stdin;
\.


--
-- Data for Name: ticket_statuses; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_statuses (id, key, name, color, is_default, is_closed, tracks_sla, sort_order, created_at, updated_at, name_uk, name_en) FROM stdin;
00000000-0000-4000-8000-000000000101	open	В работе	#C2683F	t	f	t	1	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	\N	\N
00000000-0000-4000-8000-000000000102	pending	Ожидание	#E6A817	f	f	t	2	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	\N	\N
00000000-0000-4000-8000-000000000103	resolved	Передано разработчикам	#5B8A72	f	f	f	3	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	\N	\N
00000000-0000-4000-8000-000000000104	closed	Завершено	#C7BDAF	f	t	f	4	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	\N	\N
\.


--
-- Data for Name: ticket_tags; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_tags (id, ticket_id, tag_id) FROM stdin;
\.


--
-- Data for Name: ticket_types; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_types (id, key, name, name_uk, name_en, color, is_default, weight, sort_order, created_at, updated_at) FROM stdin;
00000000-0000-4000-8000-000000000201	incident	Инцидент	\N	\N	#D64545	f	1	1	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00
00000000-0000-4000-8000-000000000202	service_request	Запрос на обслуживание	\N	\N	#4C82F7	t	1	2	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00
00000000-0000-4000-8000-000000000203	problem	Проблема	\N	\N	#E68A2E	f	1	3	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00
00000000-0000-4000-8000-000000000204	question	Вопрос	\N	\N	#8A6FE0	f	1	4	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00
\.


--
-- Data for Name: ticket_watchers; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.ticket_watchers (id, ticket_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.tickets (id, title, description, priority, created_by, assigned_to, team_id, sla_policy_id, created_at, updated_at, closed_at, deleted_at, external_thread_id, ticket_number, merged_into_id, created_on_behalf_by, category_id, channel, status_id, type_id) FROM stdin;
\.


--
-- Data for Name: user_extra_departments; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.user_extra_departments (user_id, team_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: veloxdesk
--

COPY public.users (id, email, password_hash, full_name, role, created_at, updated_at, deleted_at, refresh_token_hash, computer_name, "position", department, company, phone, city, permission_group_id, totp_secret_encrypted, two_factor_enabled, current_status_id, locale, merged_into_id, approved_at, cannot_manage_admins, profile_completed_at, is_vip, telegram_chat_id, telegram_link_token, telegram_link_token_expires_at, telegram_pending_new_ticket, telegram_csat_draft, telegram_pending_reply_to_ticket_id, auth_provider, external_id) FROM stdin;
00000000-0000-4000-8000-000000000001	system@veloxdesk.local	$2b$10$o3OmjDELOzVHRodxUv6sk.NXLwr8OAnnxBMl3nC2xcZWPms.4mZH.	Автоответчик	operator	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	2026-08-25 05:11:37.41416+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	ru	\N	2026-08-25 05:11:37.41416+00	f	\N	f	\N	\N	\N	f	\N	\N	local	\N
9b280da3-43a8-497b-80a0-bfb924d8dcd5	admin@veloxdesk.local	$2b$10$6Aw9B5XJXD0i2ayJ6vv6DuRZ4MrEmq6u0zHRpOp0Y07cExL5aLnLe	Admin	admin	2026-08-25 05:11:59.633695+00	2026-08-25 05:11:59.633695+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	ru	\N	2026-08-25 05:12:03.100211+00	f	\N	f	\N	\N	\N	f	\N	\N	local	\N
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: veloxdesk
--

SELECT pg_catalog.setval('public.migrations_id_seq', 62, true);


--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE SET; Schema: public; Owner: veloxdesk
--

SELECT pg_catalog.setval('public.tickets_ticket_number_seq', 1, false);


--
-- Name: team_members PK_1d3c06a8217a8785e2af0ec4ab8; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "PK_1d3c06a8217a8785e2af0ec4ab8" PRIMARY KEY (team_id, user_id);


--
-- Name: tickets PK_343bc942ae261cf7a1377f48fd0; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY (id);


--
-- Name: sla_policies PK_41b6803cef982534243a67b6302; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT "PK_41b6803cef982534243a67b6302" PRIMARY KEY (id);


--
-- Name: knowledge_articles PK_4dff86fc9e08f53fe1d4cfe5fb1; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT "PK_4dff86fc9e08f53fe1d4cfe5fb1" PRIMARY KEY (id);


--
-- Name: attachments PK_5e1f050bcff31e3084a1d662412; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: teams PK_7e5523774a38b08a6236d322403; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY (id);


--
-- Name: comments PK_8bf68bc960f2b69e818bdb90dcb; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: automation_rules PK_automation_rules_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT "PK_automation_rules_id" PRIMARY KEY (id);


--
-- Name: cities PK_cities_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT "PK_cities_id" PRIMARY KEY (id);


--
-- Name: companies PK_companies_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT "PK_companies_id" PRIMARY KEY (id);


--
-- Name: csat_answers PK_csat_answers_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_answers
    ADD CONSTRAINT "PK_csat_answers_id" PRIMARY KEY (id);


--
-- Name: csat_questions PK_csat_questions_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_questions
    ADD CONSTRAINT "PK_csat_questions_id" PRIMARY KEY (id);


--
-- Name: csat_surveys PK_csat_surveys_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT "PK_csat_surveys_id" PRIMARY KEY (id);


--
-- Name: custom_field_definitions PK_custom_field_definitions_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.custom_field_definitions
    ADD CONSTRAINT "PK_custom_field_definitions_id" PRIMARY KEY (id);


--
-- Name: employee_status_history PK_employee_status_history_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.employee_status_history
    ADD CONSTRAINT "PK_employee_status_history_id" PRIMARY KEY (id);


--
-- Name: employee_statuses PK_employee_statuses_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.employee_statuses
    ADD CONSTRAINT "PK_employee_statuses_id" PRIMARY KEY (id);


--
-- Name: ticket_activities PK_fea672ec7d9867e390d5a153881; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT "PK_fea672ec7d9867e390d5a153881" PRIMARY KEY (id);


--
-- Name: knowledge_theme PK_knowledge_theme_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.knowledge_theme
    ADD CONSTRAINT "PK_knowledge_theme_id" PRIMARY KEY (id);


--
-- Name: ldap_configs PK_ldap_configs_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ldap_configs
    ADD CONSTRAINT "PK_ldap_configs_id" PRIMARY KEY (id);


--
-- Name: macros PK_macros_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.macros
    ADD CONSTRAINT "PK_macros_id" PRIMARY KEY (id);


--
-- Name: oidc_configs PK_oidc_configs_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.oidc_configs
    ADD CONSTRAINT "PK_oidc_configs_id" PRIMARY KEY (id);


--
-- Name: permission_group_departments PK_permission_group_departments; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.permission_group_departments
    ADD CONSTRAINT "PK_permission_group_departments" PRIMARY KEY (permission_group_id, team_id);


--
-- Name: permission_groups PK_permission_groups_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT "PK_permission_groups_id" PRIMARY KEY (id);


--
-- Name: presence_settings PK_presence_settings_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.presence_settings
    ADD CONSTRAINT "PK_presence_settings_id" PRIMARY KEY (id);


--
-- Name: saved_reports PK_saved_reports_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.saved_reports
    ADD CONSTRAINT "PK_saved_reports_id" PRIMARY KEY (id);


--
-- Name: settings_audit_log PK_settings_audit_log_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.settings_audit_log
    ADD CONSTRAINT "PK_settings_audit_log_id" PRIMARY KEY (id);


--
-- Name: tags PK_tags_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT "PK_tags_id" PRIMARY KEY (id);


--
-- Name: ticket_categories PK_ticket_categories_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT "PK_ticket_categories_id" PRIMARY KEY (id);


--
-- Name: ticket_custom_field_values PK_ticket_custom_field_values_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_custom_field_values
    ADD CONSTRAINT "PK_ticket_custom_field_values_id" PRIMARY KEY (id);


--
-- Name: ticket_mentions PK_ticket_mentions_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_mentions
    ADD CONSTRAINT "PK_ticket_mentions_id" PRIMARY KEY (id);


--
-- Name: ticket_statuses PK_ticket_statuses_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_statuses
    ADD CONSTRAINT "PK_ticket_statuses_id" PRIMARY KEY (id);


--
-- Name: ticket_tags PK_ticket_tags_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT "PK_ticket_tags_id" PRIMARY KEY (id);


--
-- Name: ticket_types PK_ticket_types_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_types
    ADD CONSTRAINT "PK_ticket_types_id" PRIMARY KEY (id);


--
-- Name: ticket_watchers PK_ticket_watchers_id; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT "PK_ticket_watchers_id" PRIMARY KEY (id);


--
-- Name: user_extra_departments PK_user_extra_departments; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.user_extra_departments
    ADD CONSTRAINT "PK_user_extra_departments" PRIMARY KEY (user_id, team_id);


--
-- Name: sla_policies UQ_sla_policies_priority; Type: CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT "UQ_sla_policies_priority" UNIQUE (priority);


--
-- Name: IDX_2715f926ba0ddd73514eb0bef6; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_2715f926ba0ddd73514eb0bef6" ON public.ticket_activities USING btree (ticket_id);


--
-- Name: IDX_4099548d209f5ebbad2164ac56; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_4099548d209f5ebbad2164ac56" ON public.knowledge_articles USING btree (author_id);


--
-- Name: IDX_47c3fba35bfcbb08e3445f57d6; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_47c3fba35bfcbb08e3445f57d6" ON public.tickets USING btree (assigned_to);


--
-- Name: IDX_5ac6c4969ef9eccf0dc4c9381f; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_5ac6c4969ef9eccf0dc4c9381f" ON public.tickets USING btree (external_thread_id);


--
-- Name: IDX_6ceea364d29ac20cba4a38fa74; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_6ceea364d29ac20cba4a38fa74" ON public.ticket_activities USING btree (actor_id);


--
-- Name: IDX_73d871f247ffebda5dc3f0df8a; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_73d871f247ffebda5dc3f0df8a" ON public.attachments USING btree (ticket_id);


--
-- Name: IDX_8798a589dc4c71b6d0e8c2b9fc; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_8798a589dc4c71b6d0e8c2b9fc" ON public.tickets USING btree (created_by);


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- Name: IDX_9a8a82462cab47c73d25f49261; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON public.notifications USING btree (user_id);


--
-- Name: IDX_attachments_comment_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_attachments_comment_id" ON public.attachments USING btree (comment_id);


--
-- Name: IDX_attachments_uploader_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_attachments_uploader_id" ON public.attachments USING btree (uploader_id);


--
-- Name: IDX_automation_rules_trigger_enabled; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_automation_rules_trigger_enabled" ON public.automation_rules USING btree (trigger, is_enabled);


--
-- Name: IDX_be8180d9b44a05e449b85f5b77; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_be8180d9b44a05e449b85f5b77" ON public.comments USING btree (ticket_id);


--
-- Name: IDX_c2bf4967c8c2a6b845dadfbf3d; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_c2bf4967c8c2a6b845dadfbf3d" ON public.team_members USING btree (user_id);


--
-- Name: IDX_c360b09be17eb2e10280304f60; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_c360b09be17eb2e10280304f60" ON public.tickets USING btree (sla_policy_id);


--
-- Name: IDX_cities_name; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_cities_name" ON public.cities USING btree (name);


--
-- Name: IDX_comments_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_comments_created_at" ON public.comments USING btree (created_at);


--
-- Name: IDX_companies_name; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_companies_name" ON public.companies USING btree (name);


--
-- Name: IDX_csat_answers_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_csat_answers_created_at" ON public.csat_answers USING btree (created_at);


--
-- Name: IDX_csat_answers_survey_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_csat_answers_survey_id" ON public.csat_answers USING btree (survey_id);


--
-- Name: IDX_csat_answers_ticket_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_csat_answers_ticket_id" ON public.csat_answers USING btree (ticket_id);


--
-- Name: IDX_csat_surveys_ticket_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_csat_surveys_ticket_id" ON public.csat_surveys USING btree (ticket_id);


--
-- Name: IDX_e6d38899c31997c45d128a8973; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_e6d38899c31997c45d128a8973" ON public.comments USING btree (author_id);


--
-- Name: IDX_ec5071f9de4677c9e8da947e14; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_ec5071f9de4677c9e8da947e14" ON public.tickets USING btree (team_id);


--
-- Name: IDX_employee_status_history_user_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_employee_status_history_user_id" ON public.employee_status_history USING btree (user_id);


--
-- Name: IDX_knowledge_articles_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_knowledge_articles_created_at" ON public.knowledge_articles USING btree (created_at);


--
-- Name: IDX_knowledge_articles_status; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_knowledge_articles_status" ON public.knowledge_articles USING btree (status);


--
-- Name: IDX_knowledge_articles_view_count; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_knowledge_articles_view_count" ON public.knowledge_articles USING btree (view_count);


--
-- Name: IDX_ldap_configs_audience; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ldap_configs_audience" ON public.ldap_configs USING btree (audience);


--
-- Name: IDX_notifications_ticket_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_notifications_ticket_id" ON public.notifications USING btree (ticket_id);


--
-- Name: IDX_oidc_configs_audience; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_oidc_configs_audience" ON public.oidc_configs USING btree (audience);


--
-- Name: IDX_permission_group_departments_team_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_permission_group_departments_team_id" ON public.permission_group_departments USING btree (team_id);


--
-- Name: IDX_saved_reports_created_by; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_saved_reports_created_by" ON public.saved_reports USING btree (created_by);


--
-- Name: IDX_settings_audit_log_actor_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_settings_audit_log_actor_id" ON public.settings_audit_log USING btree (actor_id);


--
-- Name: IDX_settings_audit_log_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_settings_audit_log_created_at" ON public.settings_audit_log USING btree (created_at);


--
-- Name: IDX_settings_audit_log_event_type; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_settings_audit_log_event_type" ON public.settings_audit_log USING btree (event_type);


--
-- Name: IDX_settings_audit_log_module; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_settings_audit_log_module" ON public.settings_audit_log USING btree (module);


--
-- Name: IDX_tags_name; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_tags_name" ON public.tags USING btree (name);


--
-- Name: IDX_ticket_activities_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_ticket_activities_created_at" ON public.ticket_activities USING btree (created_at);


--
-- Name: IDX_ticket_categories_name; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_categories_name" ON public.ticket_categories USING btree (name);


--
-- Name: IDX_ticket_custom_field_values_ticket_field; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_custom_field_values_ticket_field" ON public.ticket_custom_field_values USING btree (ticket_id, field_id);


--
-- Name: IDX_ticket_mentions_ticket_user; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_mentions_ticket_user" ON public.ticket_mentions USING btree (ticket_id, user_id);


--
-- Name: IDX_ticket_mentions_user_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_ticket_mentions_user_id" ON public.ticket_mentions USING btree (user_id);


--
-- Name: IDX_ticket_statuses_key; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_statuses_key" ON public.ticket_statuses USING btree (key);


--
-- Name: IDX_ticket_statuses_single_default; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_statuses_single_default" ON public.ticket_statuses USING btree (is_default) WHERE (is_default = true);


--
-- Name: IDX_ticket_tags_tag_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_ticket_tags_tag_id" ON public.ticket_tags USING btree (tag_id);


--
-- Name: IDX_ticket_tags_ticket_tag; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_tags_ticket_tag" ON public.ticket_tags USING btree (ticket_id, tag_id);


--
-- Name: IDX_ticket_types_key; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_types_key" ON public.ticket_types USING btree (key);


--
-- Name: IDX_ticket_types_single_default; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_types_single_default" ON public.ticket_types USING btree (is_default) WHERE (is_default = true);


--
-- Name: IDX_ticket_watchers_ticket_user; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_ticket_watchers_ticket_user" ON public.ticket_watchers USING btree (ticket_id, user_id);


--
-- Name: IDX_ticket_watchers_user_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_ticket_watchers_user_id" ON public.ticket_watchers USING btree (user_id);


--
-- Name: IDX_tickets_category_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_category_id" ON public.tickets USING btree (category_id);


--
-- Name: IDX_tickets_channel; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_channel" ON public.tickets USING btree (channel);


--
-- Name: IDX_tickets_created_at; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_created_at" ON public.tickets USING btree (created_at);


--
-- Name: IDX_tickets_created_on_behalf_by; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_created_on_behalf_by" ON public.tickets USING btree (created_on_behalf_by);


--
-- Name: IDX_tickets_merged_into_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_merged_into_id" ON public.tickets USING btree (merged_into_id);


--
-- Name: IDX_tickets_priority; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_priority" ON public.tickets USING btree (priority);


--
-- Name: IDX_tickets_status_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_status_id" ON public.tickets USING btree (status_id);


--
-- Name: IDX_tickets_ticket_number; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_tickets_ticket_number" ON public.tickets USING btree (ticket_number);


--
-- Name: IDX_tickets_type_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_tickets_type_id" ON public.tickets USING btree (type_id);


--
-- Name: IDX_user_extra_departments_team_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_user_extra_departments_team_id" ON public.user_extra_departments USING btree (team_id);


--
-- Name: IDX_users_auth_provider_external_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_users_auth_provider_external_id" ON public.users USING btree (auth_provider, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: IDX_users_merged_into_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_users_merged_into_id" ON public.users USING btree (merged_into_id);


--
-- Name: IDX_users_pending; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_users_pending" ON public.users USING btree (created_at) WHERE (approved_at IS NULL);


--
-- Name: IDX_users_permission_group_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE INDEX "IDX_users_permission_group_id" ON public.users USING btree (permission_group_id);


--
-- Name: IDX_users_telegram_chat_id; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_users_telegram_chat_id" ON public.users USING btree (telegram_chat_id);


--
-- Name: IDX_users_telegram_link_token; Type: INDEX; Schema: public; Owner: veloxdesk
--

CREATE UNIQUE INDEX "IDX_users_telegram_link_token" ON public.users USING btree (telegram_link_token);


--
-- Name: ticket_activities FK_2715f926ba0ddd73514eb0bef61; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT "FK_2715f926ba0ddd73514eb0bef61" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: knowledge_articles FK_4099548d209f5ebbad2164ac562; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT "FK_4099548d209f5ebbad2164ac562" FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: tickets FK_47c3fba35bfcbb08e3445f57d6e; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_47c3fba35bfcbb08e3445f57d6e" FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: ticket_activities FK_6ceea364d29ac20cba4a38fa748; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_activities
    ADD CONSTRAINT "FK_6ceea364d29ac20cba4a38fa748" FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: attachments FK_73d871f247ffebda5dc3f0df8a4; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "FK_73d871f247ffebda5dc3f0df8a4" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets FK_8798a589dc4c71b6d0e8c2b9fc3; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_8798a589dc4c71b6d0e8c2b9fc3" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notifications FK_9a8a82462cab47c73d25f49261f; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attachments FK_attachments_comment; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "FK_attachments_comment" FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: attachments FK_attachments_uploader; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT "FK_attachments_uploader" FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: comments FK_be8180d9b44a05e449b85f5b773; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_be8180d9b44a05e449b85f5b773" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: team_members FK_c2bf4967c8c2a6b845dadfbf3d4; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets FK_c360b09be17eb2e10280304f606; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_c360b09be17eb2e10280304f606" FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id);


--
-- Name: csat_answers FK_csat_answers_question; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_answers
    ADD CONSTRAINT "FK_csat_answers_question" FOREIGN KEY (question_id) REFERENCES public.csat_questions(id) ON DELETE SET NULL;


--
-- Name: csat_answers FK_csat_answers_survey; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_answers
    ADD CONSTRAINT "FK_csat_answers_survey" FOREIGN KEY (survey_id) REFERENCES public.csat_surveys(id) ON DELETE CASCADE;


--
-- Name: csat_answers FK_csat_answers_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_answers
    ADD CONSTRAINT "FK_csat_answers_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: csat_surveys FK_csat_surveys_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.csat_surveys
    ADD CONSTRAINT "FK_csat_surveys_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: custom_field_definitions FK_custom_field_definitions_depends_on; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.custom_field_definitions
    ADD CONSTRAINT "FK_custom_field_definitions_depends_on" FOREIGN KEY (depends_on_field_id) REFERENCES public.custom_field_definitions(id) ON DELETE SET NULL;


--
-- Name: comments FK_e6d38899c31997c45d128a8973b; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_e6d38899c31997c45d128a8973b" FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: tickets FK_ec5071f9de4677c9e8da947e144; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_ec5071f9de4677c9e8da947e144" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: employee_status_history FK_employee_status_history_user; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.employee_status_history
    ADD CONSTRAINT "FK_employee_status_history_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team_members FK_fdad7d5768277e60c40e01cdcea; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: notifications FK_notifications_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_notifications_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: permission_group_departments FK_permission_group_departments_group; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.permission_group_departments
    ADD CONSTRAINT "FK_permission_group_departments_group" FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: permission_group_departments FK_permission_group_departments_team; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.permission_group_departments
    ADD CONSTRAINT "FK_permission_group_departments_team" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: saved_reports FK_saved_reports_created_by; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.saved_reports
    ADD CONSTRAINT "FK_saved_reports_created_by" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: settings_audit_log FK_settings_audit_log_actor_id; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.settings_audit_log
    ADD CONSTRAINT "FK_settings_audit_log_actor_id" FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: ticket_custom_field_values FK_ticket_custom_field_values_field; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_custom_field_values
    ADD CONSTRAINT "FK_ticket_custom_field_values_field" FOREIGN KEY (field_id) REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE;


--
-- Name: ticket_custom_field_values FK_ticket_custom_field_values_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_custom_field_values
    ADD CONSTRAINT "FK_ticket_custom_field_values_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_mentions FK_ticket_mentions_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_mentions
    ADD CONSTRAINT "FK_ticket_mentions_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_mentions FK_ticket_mentions_user; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_mentions
    ADD CONSTRAINT "FK_ticket_mentions_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ticket_tags FK_ticket_tags_tag; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT "FK_ticket_tags_tag" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: ticket_tags FK_ticket_tags_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_tags
    ADD CONSTRAINT "FK_ticket_tags_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_watchers FK_ticket_watchers_ticket; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT "FK_ticket_watchers_ticket" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_watchers FK_ticket_watchers_user; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.ticket_watchers
    ADD CONSTRAINT "FK_ticket_watchers_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets FK_tickets_category; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_tickets_category" FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);


--
-- Name: tickets FK_tickets_created_on_behalf_by; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_tickets_created_on_behalf_by" FOREIGN KEY (created_on_behalf_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets FK_tickets_merged_into; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_tickets_merged_into" FOREIGN KEY (merged_into_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: tickets FK_tickets_status; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_tickets_status" FOREIGN KEY (status_id) REFERENCES public.ticket_statuses(id) ON DELETE RESTRICT;


--
-- Name: tickets FK_tickets_type; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT "FK_tickets_type" FOREIGN KEY (type_id) REFERENCES public.ticket_types(id) ON DELETE RESTRICT;


--
-- Name: user_extra_departments FK_user_extra_departments_team; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.user_extra_departments
    ADD CONSTRAINT "FK_user_extra_departments_team" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: user_extra_departments FK_user_extra_departments_user; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.user_extra_departments
    ADD CONSTRAINT "FK_user_extra_departments_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users FK_users_current_status; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_users_current_status" FOREIGN KEY (current_status_id) REFERENCES public.employee_statuses(id) ON DELETE SET NULL;


--
-- Name: users FK_users_merged_into; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_users_merged_into" FOREIGN KEY (merged_into_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users FK_users_permission_group; Type: FK CONSTRAINT; Schema: public; Owner: veloxdesk
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_users_permission_group" FOREIGN KEY (permission_group_id) REFERENCES public.permission_groups(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict gJSg3J2sECoLd2jZkCuLvMulQGlRdcJAveyV1H9pjA67WiK88i23745vAYyCHoQ

