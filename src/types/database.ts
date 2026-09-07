/**
 * Hand-authored to mirror `supabase/migrations/*.sql` exactly, because no
 * live Supabase project is linked in this environment to run
 * `supabase gen types typescript`. Once one exists, regenerate this file
 * with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 *
 * and delete this note. Keep this file in sync with the migrations until
 * then — it is the only thing standing between a schema typo and a runtime
 * error, since there is no ORM.
 */

export type MoneyScope = "PERSONAL" | "HOUSEHOLD";
export type HouseholdRole = "owner" | "admin" | "member";
export type WalletType = "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type CategoryTransactionType = "INCOME" | "EXPENSE";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created only by the handle_new_user trigger
        Update: {
          display_name?: string;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
        };
        Update: {
          role?: HouseholdRole;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          wallet_type: WalletType;
          currency: string;
          icon: string | null;
          is_archived: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          name: string;
          wallet_type?: WalletType;
          currency?: string;
          icon?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          wallet_type?: WalletType;
          icon?: string | null;
          is_archived?: boolean;
        };
        Relationships: [];
      };
      pockets: {
        Row: {
          id: string;
          wallet_id: string;
          name: string;
          icon: string | null;
          sort_order: number;
          is_default: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          name: string;
          icon?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          icon?: string | null;
          sort_order?: number;
          is_archived?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pockets_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          transaction_type: CategoryTransactionType;
          parent_id: string | null;
          icon: string | null;
          sort_order: number;
          is_system: boolean;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          name: string;
          transaction_type: CategoryTransactionType;
          parent_id?: string | null;
          icon?: string | null;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          name?: string;
          icon?: string | null;
          sort_order?: number;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          transaction_type: TransactionType;
          category_id: string | null;
          title: string | null;
          note: string | null;
          occurred_at: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: never; // created only via the create_* RPC functions
        Update: {
          title?: string | null;
          note?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_entries: {
        Row: {
          id: string;
          transaction_id: string;
          wallet_id: string;
          pocket_id: string;
          amount: string; // numeric(14,2) arrives as a string over PostgREST
          created_at: string;
        };
        Insert: never; // created only via the create_* RPC functions
        Update: never; // immutable ledger lines
        Relationships: [
          {
            foreignKeyName: "transaction_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_entries_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_entries_pocket_id_fkey";
            columns: ["pocket_id"];
            isOneToOne: false;
            referencedRelation: "pockets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      has_household_role: {
        Args: { p_household_id: string; p_roles: HouseholdRole[] };
        Returns: boolean;
      };
      add_household_member: {
        Args: { p_household_id: string; p_email: string; p_role?: HouseholdRole };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      get_pocket_balance: {
        Args: { p_pocket_id: string };
        Returns: string;
      };
      get_wallet_balance: {
        Args: { p_wallet_id: string };
        Returns: string;
      };
      create_income_expense_transaction: {
        Args: {
          p_transaction_type: "INCOME" | "EXPENSE";
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
      };
      create_pocket_transfer: {
        Args: {
          p_wallet_id: string;
          p_from_pocket_id: string;
          p_to_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
      };
      create_wallet_transfer: {
        Args: {
          p_from_wallet_id: string;
          p_from_pocket_id: string;
          p_to_wallet_id: string;
          p_to_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      household_role: HouseholdRole;
      money_scope: MoneyScope;
      wallet_type: WalletType;
      transaction_type: TransactionType;
      category_transaction_type: CategoryTransactionType;
    };
    CompositeTypes: Record<string, never>;
  };
}
