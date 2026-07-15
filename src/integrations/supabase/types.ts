// Tipos do banco Vest IA.
// Espelham o schema de supabase/migrations/0001_init.sql.
// Podem ser regenerados com a CLI:
//   supabase gen types typescript --project-id <ref> --schema public > types.ts

export type PlanType = "starter" | "pro" | "business";
export type UserRoleDb = "owner" | "manager" | "seller";
export type StoreSegmentDb = "feminina" | "masculina" | "unissex";
export type AssetType = "model" | "look" | "background" | "generated";
export type GenerationTypeDb = "provador" | "post" | "scanner";
export type TransactionType = "credit" | "debit";
export type InviteStatusDb = "pending" | "accepted" | "revoked";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

// JSON serializável (para colunas jsonb).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          plan: PlanType;
          tokens_balance: number;
          segment: StoreSegmentDb;
          logo_url: string | null;
          description: string | null;
          location: string | null;
          phone: string | null;
          email: string | null;
          instagram: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          plan?: PlanType;
          tokens_balance?: number;
          segment?: StoreSegmentDb;
          logo_url?: string | null;
          description?: string | null;
          location?: string | null;
          phone?: string | null;
          email?: string | null;
          instagram?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          cnpj?: string | null;
          plan?: PlanType;
          tokens_balance?: number;
          segment?: StoreSegmentDb;
          logo_url?: string | null;
          description?: string | null;
          location?: string | null;
          phone?: string | null;
          email?: string | null;
          instagram?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          store_id: string;
          email: string;
          name: string | null;
          role: UserRoleDb;
          invited_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          store_id: string;
          email: string;
          name?: string | null;
          role?: UserRoleDb;
          invited_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          email?: string;
          name?: string | null;
          role?: UserRoleDb;
          invited_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          store_id: string;
          user_id: string | null;
          type: AssetType;
          url: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id?: string | null;
          type: AssetType;
          url: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string | null;
          type?: AssetType;
          url?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      generations: {
        Row: {
          id: string;
          store_id: string;
          user_id: string | null;
          type: GenerationTypeDb;
          input_refs: Json | null;
          output_url: string | null;
          tokens_used: number;
          is_favorite: boolean;
          client_id: string | null;
          copies: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id?: string | null;
          type: GenerationTypeDb;
          input_refs?: Json | null;
          output_url?: string | null;
          tokens_used?: number;
          is_favorite?: boolean;
          client_id?: string | null;
          copies?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string | null;
          type?: GenerationTypeDb;
          input_refs?: Json | null;
          output_url?: string | null;
          tokens_used?: number;
          is_favorite?: boolean;
          client_id?: string | null;
          copies?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      store_invites: {
        Row: {
          id: string;
          store_id: string;
          email: string | null;
          token: string;
          role: UserRoleDb;
          invited_by: string | null;
          status: InviteStatusDb;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          email?: string | null;
          token?: string;
          role?: UserRoleDb;
          invited_by?: string | null;
          status?: InviteStatusDb;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          email?: string | null;
          token?: string;
          role?: UserRoleDb;
          invited_by?: string | null;
          status?: InviteStatusDb;
          created_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      catalog_items: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          category: string | null;
          price: number | null;
          image_url: string | null;
          clean_image_url: string | null;
          description: string | null;
          sku: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          category?: string | null;
          price?: number | null;
          image_url?: string | null;
          clean_image_url?: string | null;
          description?: string | null;
          sku?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          category?: string | null;
          price?: number | null;
          image_url?: string | null;
          clean_image_url?: string | null;
          description?: string | null;
          sku?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          email: string | null;
          instagram: string | null;
          phone: string | null;
          notes: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          email?: string | null;
          instagram?: string | null;
          phone?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          email?: string | null;
          instagram?: string | null;
          phone?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      product_sheets: {
        Row: {
          id: string;
          store_id: string;
          asset_id: string | null;
          fields_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          asset_id?: string | null;
          fields_json: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          asset_id?: string | null;
          fields_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      token_transactions: {
        Row: {
          id: string;
          store_id: string;
          type: TransactionType;
          amount: number;
          ref_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          type: TransactionType;
          amount: number;
          ref_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          type?: TransactionType;
          amount?: number;
          ref_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          store_id: string;
          plan: PlanType;
          status: SubscriptionStatus;
          next_billing: string | null;
          payment_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          plan: PlanType;
          status?: SubscriptionStatus;
          next_billing?: string | null;
          payment_ref?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          plan?: PlanType;
          status?: SubscriptionStatus;
          next_billing?: string | null;
          payment_ref?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_store_id: {
        Args: Record<never, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<never, never>;
        Returns: UserRoleDb;
      };
      debit_tokens: {
        Args: { p_amount: number; p_reason?: string | null; p_ref?: string | null };
        Returns: number;
      };
      credit_tokens: {
        Args: { p_amount: number; p_reason?: string | null };
        Returns: number;
      };
      get_invite_by_token: {
        Args: { p_token: string };
        Returns: { store_name: string; role: UserRoleDb }[];
      };
    };
    Enums: {
      plan_type: PlanType;
      user_role: UserRoleDb;
      asset_type: AssetType;
      generation_type: GenerationTypeDb;
      transaction_type: TransactionType;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

// Atalhos úteis para os services.
export type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
export type ProductSheetRow =
  Database["public"]["Tables"]["product_sheets"]["Row"];
export type TokenTransactionRow =
  Database["public"]["Tables"]["token_transactions"]["Row"];
export type SubscriptionRow =
  Database["public"]["Tables"]["subscriptions"]["Row"];
export type StoreInviteRow =
  Database["public"]["Tables"]["store_invites"]["Row"];
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type CatalogItemRow =
  Database["public"]["Tables"]["catalog_items"]["Row"];
