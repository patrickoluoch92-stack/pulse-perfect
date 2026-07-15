export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_agent_decisions: {
        Row: {
          action: string
          agent_slug: string
          confidence: number | null
          created_at: string
          id: string
          inputs: Json
          outputs: Json
          rationale: string | null
          run_id: string | null
          subject_id: string | null
          subject_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          agent_slug: string
          confidence?: number | null
          created_at?: string
          id?: string
          inputs?: Json
          outputs?: Json
          rationale?: string | null
          run_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          agent_slug?: string
          confidence?: number | null
          created_at?: string
          id?: string
          inputs?: Json
          outputs?: Json
          rationale?: string | null
          run_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_jobs: {
        Row: {
          agent_slug: string
          attempts: number
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          last_error: string | null
          max_attempts: number
          next_run_at: string
          payload: Json
          priority: number
          status: string
          updated_at: string
        }
        Insert: {
          agent_slug: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          agent_slug?: string
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          priority?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_agent_runs: {
        Row: {
          agent_slug: string
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          job_id: string | null
          latency_ms: number | null
          metadata: Json
          model: string | null
          status: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          agent_slug: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          status: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          agent_slug?: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          concurrency_cap: number
          config: Json
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          hourly_cost_budget_usd: number
          id: string
          paused: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          concurrency_cap?: number
          config?: Json
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          hourly_cost_budget_usd?: number
          id?: string
          paused?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          concurrency_cap?: number
          config?: Json
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          hourly_cost_budget_usd?: number
          id?: string
          paused?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_errors: {
        Row: {
          action: string | null
          context: Json
          correlation_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          org_id: string | null
          source: string | null
          stack: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          org_id?: string | null
          source?: string | null
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          org_id?: string | null
          source?: string | null
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          org_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_commissions: {
        Row: {
          booking_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          credited_ledger_id: string | null
          currency: string
          gross_amount: number
          id: string
          levy_amount: number
          net_owner_amount: number
          org_id: string
          property_id: string
          reversed_ledger_id: string | null
          rule_id: string | null
          service_fee_amount: number
          settled_ledger_id: string | null
          status: string
          updated_at: string
          vat_amount: number
        }
        Insert: {
          booking_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          credited_ledger_id?: string | null
          currency?: string
          gross_amount: number
          id?: string
          levy_amount?: number
          net_owner_amount: number
          org_id: string
          property_id: string
          reversed_ledger_id?: string | null
          rule_id?: string | null
          service_fee_amount?: number
          settled_ledger_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          booking_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          credited_ledger_id?: string | null
          currency?: string
          gross_amount?: number
          id?: string
          levy_amount?: number
          net_owner_amount?: number
          org_id?: string
          property_id?: string
          reversed_ledger_id?: string | null
          rule_id?: string | null
          service_fee_amount?: number
          settled_ledger_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "marketplace_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_credited_ledger_id_fkey"
            columns: ["credited_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_reversed_ledger_id_fkey"
            columns: ["reversed_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_commissions_settled_ledger_id_fkey"
            columns: ["settled_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_blocks: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          org_id: string
          raw: Json | null
          source_id: string | null
          starts_on: string
          summary: string | null
          uid: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          org_id: string
          raw?: Json | null
          source_id?: string | null
          starts_on: string
          summary?: string | null
          uid: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          org_id?: string
          raw?: Json | null
          source_id?: string | null
          starts_on?: string
          summary?: string | null
          uid?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_blocks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ical_import_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_blocks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          flat_amount: number
          id: string
          name: string
          notes: string | null
          priority: number
          rate_percent: number
          scope: Database["public"]["Enums"]["commission_scope"]
          scope_value: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          flat_amount?: number
          id?: string
          name: string
          notes?: string | null
          priority?: number
          rate_percent?: number
          scope?: Database["public"]["Enums"]["commission_scope"]
          scope_value?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          flat_amount?: number
          id?: string
          name?: string
          notes?: string | null
          priority?: number
          rate_percent?: number
          scope?: Database["public"]["Enums"]["commission_scope"]
          scope_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      county_market_stats: {
        Row: {
          avg_nightly_rate: number | null
          bookings_30d: number
          category: string | null
          county: string
          created_at: string
          demand_index: number | null
          discovered_count: number
          gmv_30d: number
          hotspot_score: number | null
          id: string
          listing_count: number
          median_nightly_rate: number | null
          occupancy_proxy: number | null
          payload: Json
          rollup_date: string
          supply_index: number | null
          updated_at: string
        }
        Insert: {
          avg_nightly_rate?: number | null
          bookings_30d?: number
          category?: string | null
          county: string
          created_at?: string
          demand_index?: number | null
          discovered_count?: number
          gmv_30d?: number
          hotspot_score?: number | null
          id?: string
          listing_count?: number
          median_nightly_rate?: number | null
          occupancy_proxy?: number | null
          payload?: Json
          rollup_date: string
          supply_index?: number | null
          updated_at?: string
        }
        Update: {
          avg_nightly_rate?: number | null
          bookings_30d?: number
          category?: string | null
          county?: string
          created_at?: string
          demand_index?: number | null
          discovered_count?: number
          gmv_30d?: number
          hotspot_score?: number | null
          id?: string
          listing_count?: number
          median_nightly_rate?: number | null
          occupancy_proxy?: number | null
          payload?: Json
          rollup_date?: string
          supply_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_redemptions: number | null
          redemptions_count: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemptions_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemptions_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      discovered_properties: {
        Row: {
          address: string | null
          ai_confidence: Json
          ai_description: string | null
          amenities: string[]
          county_code: string | null
          created_at: string
          dedupe_fingerprint: string | null
          email: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_source_hash: string | null
          embedding_updated_at: string | null
          id: string
          keywords: string[]
          latitude: number | null
          longitude: number | null
          merged_into: string | null
          name: string
          phone: string | null
          promoted_property_id: string | null
          property_type: string | null
          quality_score: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          socials: Json
          source_id: string | null
          source_url: string | null
          status: string
          tags: string[]
          town: string | null
          updated_at: string
          ward: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          ai_confidence?: Json
          ai_description?: string | null
          amenities?: string[]
          county_code?: string | null
          created_at?: string
          dedupe_fingerprint?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          id?: string
          keywords?: string[]
          latitude?: number | null
          longitude?: number | null
          merged_into?: string | null
          name: string
          phone?: string | null
          promoted_property_id?: string | null
          property_type?: string | null
          quality_score?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          socials?: Json
          source_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          town?: string | null
          updated_at?: string
          ward?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          ai_confidence?: Json
          ai_description?: string | null
          amenities?: string[]
          county_code?: string | null
          created_at?: string
          dedupe_fingerprint?: string | null
          email?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          id?: string
          keywords?: string[]
          latitude?: number | null
          longitude?: number | null
          merged_into?: string | null
          name?: string
          phone?: string | null
          promoted_property_id?: string | null
          property_type?: string | null
          quality_score?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          socials?: Json
          source_id?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          town?: string | null
          updated_at?: string
          ward?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_properties_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_properties_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_properties_promoted_property_id_fkey"
            columns: ["promoted_property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_properties_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "discovery_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_feedback: {
        Row: {
          after_value: Json | null
          before_value: Json | null
          discovered_id: string | null
          edited_at: string
          editor_id: string | null
          field: string
          id: string
        }
        Insert: {
          after_value?: Json | null
          before_value?: Json | null
          discovered_id?: string | null
          edited_at?: string
          editor_id?: string | null
          field: string
          id?: string
        }
        Update: {
          after_value?: Json | null
          before_value?: Json | null
          discovered_id?: string | null
          edited_at?: string
          editor_id?: string | null
          field?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_feedback_discovered_id_fkey"
            columns: ["discovered_id"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_feedback_discovered_id_fkey"
            columns: ["discovered_id"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_image_hashes: {
        Row: {
          created_at: string
          discovered_property_id: string | null
          height: number | null
          id: string
          image_url: string
          phash: string
          property_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          discovered_property_id?: string | null
          height?: number | null
          id?: string
          image_url: string
          phash: string
          property_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          discovered_property_id?: string | null
          height?: number | null
          id?: string
          image_url?: string
          phash?: string
          property_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_image_hashes_discovered_property_id_fkey"
            columns: ["discovered_property_id"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_image_hashes_discovered_property_id_fkey"
            columns: ["discovered_property_id"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_image_hashes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          ok: boolean | null
          source_id: string | null
          started_at: string
          stats: Json
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          ok?: boolean | null
          source_id?: string | null
          started_at?: string
          stats?: Json
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          ok?: boolean | null
          source_id?: string | null
          started_at?: string
          stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "discovery_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sources: {
        Row: {
          county_code: string | null
          created_at: string
          enabled: boolean
          id: string
          kind: string
          label: string | null
          last_crawled_at: string | null
          updated_at: string
          url: string
        }
        Insert: {
          county_code?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          label?: string | null
          last_crawled_at?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          county_code?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string | null
          last_crawled_at?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      external_listings: {
        Row: {
          country_code: string
          county_code: string | null
          created_at: string
          currency: string | null
          deeplink_url: string
          external_id: string
          id: string
          image_url: string | null
          last_synced_at: string
          latitude: number | null
          longitude: number | null
          name: string
          price_per_night: number | null
          provider: string
          rating: number | null
          raw: Json
          review_count: number | null
          town: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string
          county_code?: string | null
          created_at?: string
          currency?: string | null
          deeplink_url: string
          external_id: string
          id?: string
          image_url?: string | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          price_per_night?: number | null
          provider: string
          rating?: number | null
          raw?: Json
          review_count?: number | null
          town?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          county_code?: string | null
          created_at?: string
          currency?: string | null
          deeplink_url?: string
          external_id?: string
          id?: string
          image_url?: string | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          price_per_night?: number | null
          provider?: string
          rating?: number | null
          raw?: Json
          review_count?: number | null
          town?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      external_sync_runs: {
        Row: {
          created_at: string
          destination: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_found: number
          items_upserted: number
          mode: string
          provider: string
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          destination?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number
          items_upserted?: number
          mode?: string
          provider: string
          started_at?: string
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          destination?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number
          items_upserted?: number
          mode?: string
          provider?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      guest_wishlists: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_wishlists_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      heatmap_cells: {
        Row: {
          avg_nightly_rate: number | null
          bookings_30d: number
          cell_key: string
          county: string | null
          created_at: string
          id: string
          intensity: number | null
          lat_bucket: number
          listing_count: number
          lng_bucket: number
          rollup_date: string
          updated_at: string
        }
        Insert: {
          avg_nightly_rate?: number | null
          bookings_30d?: number
          cell_key: string
          county?: string | null
          created_at?: string
          id?: string
          intensity?: number | null
          lat_bucket: number
          listing_count?: number
          lng_bucket: number
          rollup_date: string
          updated_at?: string
        }
        Update: {
          avg_nightly_rate?: number | null
          bookings_30d?: number
          cell_key?: string
          county?: string | null
          created_at?: string
          id?: string
          intensity?: number | null
          lat_bucket?: number
          listing_count?: number
          lng_bucket?: number
          rollup_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      housekeeping_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          priority: string
          property_id: string | null
          scheduled_for: string
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          priority?: string
          property_id?: string | null
          scheduled_for: string
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          priority?: string
          property_id?: string | null
          scheduled_for?: string
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_access_log: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          org_id: string | null
          status: string
          token_prefix: string
          unit_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          org_id?: string | null
          status: string
          token_prefix: string
          unit_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          org_id?: string | null
          status?: string
          token_prefix?: string
          unit_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ical_access_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_access_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_import_sources: {
        Row: {
          created_at: string
          event_count: number
          id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          name: string
          org_id: string
          unit_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          event_count?: number
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          name: string
          org_id: string
          unit_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          event_count?: number
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          name?: string
          org_id?: string
          unit_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_import_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_import_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_incident_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          incident_id: string
          note: string | null
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          incident_id: string
          note?: string | null
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          note?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_incident_audit_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ical_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_incident_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_incident_reads: {
        Row: {
          incident_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          incident_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          incident_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_incident_reads_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ical_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_incident_webhooks: {
        Row: {
          attempt_count: number
          created_at: string
          enabled: boolean
          id: string
          last_attempt_at: string | null
          last_delivered_at: string | null
          last_error: string | null
          last_status: string | null
          last_test_at: string | null
          org_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_attempt_at?: string | null
          last_delivered_at?: string | null
          last_error?: string | null
          last_status?: string | null
          last_test_at?: string | null
          org_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_attempt_at?: string | null
          last_delivered_at?: string | null
          last_error?: string | null
          last_status?: string | null
          last_test_at?: string | null
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_incident_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          fingerprint: string
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          message: string
          occurrences: number
          org_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          kind: string
          last_seen_at?: string
          message: string
          occurrences?: number
          org_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          message?: string
          occurrences?: number
          org_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event: string
          http_status: number | null
          id: string
          last_error: string | null
          org_id: string
          payload: Json
          status: string
          updated_at: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          http_status?: number | null
          id?: string
          last_error?: string | null
          org_id: string
          payload: Json
          status?: string
          updated_at?: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          http_status?: number | null
          id?: string
          last_error?: string | null
          org_id?: string
          payload?: Json
          status?: string
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_webhook_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "ical_incident_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      image_ai_tags: {
        Row: {
          caption: string | null
          created_at: string
          dominant_colors: string[]
          id: string
          image_id: string
          labels: string[]
          model_version: string | null
          property_id: string
          quality_score: number | null
          room_type: string | null
          safety_flags: string[]
        }
        Insert: {
          caption?: string | null
          created_at?: string
          dominant_colors?: string[]
          id?: string
          image_id: string
          labels?: string[]
          model_version?: string | null
          property_id: string
          quality_score?: number | null
          room_type?: string | null
          safety_flags?: string[]
        }
        Update: {
          caption?: string | null
          created_at?: string
          dominant_colors?: string[]
          id?: string
          image_id?: string
          labels?: string[]
          model_version?: string | null
          property_id?: string
          quality_score?: number | null
          room_type?: string | null
          safety_flags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "image_ai_tags_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: true
            referencedRelation: "marketplace_property_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_ai_tags_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          org_id: string
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          org_id: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          org_id?: string
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          due_at: string | null
          guest_id: string | null
          id: string
          issued_at: string
          notes: string | null
          number: string
          org_id: string
          reservation_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          due_at?: string | null
          guest_id?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number: string
          org_id: string
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          due_at?: string | null
          guest_id?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          number?: string
          org_id?: string
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      kenya_counties: {
        Row: {
          code: string
          name: string
          region: string | null
          slug: string
        }
        Insert: {
          code: string
          name: string
          region?: string | null
          slug: string
        }
        Update: {
          code?: string
          name?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      knowledge_fact_history: {
        Row: {
          archived_at: string
          computed_at: string
          confidence: number
          fact_id: string
          id: string
          org_id: string | null
          payload: Json
          property_id: string
          scope: string
          source_engine: string
          version: number
        }
        Insert: {
          archived_at?: string
          computed_at: string
          confidence: number
          fact_id: string
          id?: string
          org_id?: string | null
          payload: Json
          property_id: string
          scope: string
          source_engine: string
          version: number
        }
        Update: {
          archived_at?: string
          computed_at?: string
          confidence?: number
          fact_id?: string
          id?: string
          org_id?: string | null
          payload?: Json
          property_id?: string
          scope?: string
          source_engine?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_fact_history_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "knowledge_property_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_property_facts: {
        Row: {
          computed_at: string
          confidence: number
          created_at: string
          created_by: string | null
          id: string
          org_id: string | null
          payload: Json
          property_id: string
          scope: string
          source_engine: string
          updated_at: string
          version: number
        }
        Insert: {
          computed_at?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          payload?: Json
          property_id: string
          scope: string
          source_engine: string
          updated_at?: string
          version?: number
        }
        Update: {
          computed_at?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string | null
          payload?: Json
          property_id?: string
          scope?: string
          source_engine?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      knowledge_search_events: {
        Row: {
          created_at: string
          engine: string
          filters: Json
          id: string
          latency_ms: number | null
          org_id: string | null
          query: string
          result_count: number
          top_property_ids: string[]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          engine: string
          filters?: Json
          id?: string
          latency_ms?: number | null
          org_id?: string | null
          query: string
          result_count?: number
          top_property_ids?: string[]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          engine?: string
          filters?: Json
          id?: string
          latency_ms?: number | null
          org_id?: string | null
          query?: string
          result_count?: number
          top_property_ids?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          lifetime_points: number
          points_balance: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lifetime_points?: number
          points_balance?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          lifetime_points?: number
          points_balance?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      maintenance_tickets: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          id: string
          org_id: string
          property_id: string | null
          reported_by: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id: string
          property_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id?: string
          property_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_availability_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          property_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          property_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          property_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_availability_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bookings: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          currency: string
          guest_email: string
          guest_id: string | null
          guest_name: string
          guest_phone: string | null
          guests_count: number
          id: string
          mpesa_transaction_id: string | null
          notes: string | null
          property_id: string
          status: Database["public"]["Enums"]["marketplace_booking_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          currency?: string
          guest_email: string
          guest_id?: string | null
          guest_name: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          mpesa_transaction_id?: string | null
          notes?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["marketplace_booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          currency?: string
          guest_email?: string
          guest_id?: string | null
          guest_name?: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          mpesa_transaction_id?: string | null
          notes?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["marketplace_booking_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bookings_mpesa_transaction_id_fkey"
            columns: ["mpesa_transaction_id"]
            isOneToOne: false
            referencedRelation: "mpesa_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_properties: {
        Row: {
          accessibility_notes: string | null
          activities: string[]
          amenities: string[]
          attributes: string[]
          availability: Database["public"]["Enums"]["mkt_availability"]
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          best_seasons: string[]
          capacity: number | null
          category: Database["public"]["Enums"]["mkt_property_category"]
          check_in_time: string | null
          check_out_time: string | null
          child_category_slug: string | null
          constituency: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          county_code: string
          created_at: string
          created_by: string
          currency: string
          description: string
          embedding: string | null
          embedding_model: string | null
          embedding_source_hash: string | null
          embedding_updated_at: string | null
          estate: string | null
          furnished: boolean | null
          google_maps_url: string | null
          id: string
          is_featured: boolean
          is_verified: boolean
          land_size_acres: number | null
          landmarks: Json
          latitude: number | null
          lease_period_months: number | null
          listing_intent: string
          longitude: number | null
          main_image_path: string | null
          name: string
          nearby_parks: string[]
          neighbourhood: string | null
          occupancy_status: string | null
          org_id: string
          parent_category_slug: string | null
          parking_spaces: number | null
          postal_address: string | null
          price_per_night: number | null
          rating_avg: number
          rating_count: number
          rejection_reason: string | null
          rent_daily: number | null
          rent_monthly: number | null
          rent_weekly: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          sale_price: number | null
          secondary_categories: string[]
          security_deposit: number | null
          service_charge: number | null
          slug: string
          status: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at: string | null
          sustainability_notes: string | null
          town: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          ward: string | null
        }
        Insert: {
          accessibility_notes?: string | null
          activities?: string[]
          amenities?: string[]
          attributes?: string[]
          availability?: Database["public"]["Enums"]["mkt_availability"]
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          best_seasons?: string[]
          capacity?: number | null
          category: Database["public"]["Enums"]["mkt_property_category"]
          check_in_time?: string | null
          check_out_time?: string | null
          child_category_slug?: string | null
          constituency?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          county_code: string
          created_at?: string
          created_by: string
          currency?: string
          description: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          estate?: string | null
          furnished?: boolean | null
          google_maps_url?: string | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean
          land_size_acres?: number | null
          landmarks?: Json
          latitude?: number | null
          lease_period_months?: number | null
          listing_intent?: string
          longitude?: number | null
          main_image_path?: string | null
          name: string
          nearby_parks?: string[]
          neighbourhood?: string | null
          occupancy_status?: string | null
          org_id: string
          parent_category_slug?: string | null
          parking_spaces?: number | null
          postal_address?: string | null
          price_per_night?: number | null
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          rent_daily?: number | null
          rent_monthly?: number | null
          rent_weekly?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_price?: number | null
          secondary_categories?: string[]
          security_deposit?: number | null
          service_charge?: number | null
          slug: string
          status?: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at?: string | null
          sustainability_notes?: string | null
          town: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          ward?: string | null
        }
        Update: {
          accessibility_notes?: string | null
          activities?: string[]
          amenities?: string[]
          attributes?: string[]
          availability?: Database["public"]["Enums"]["mkt_availability"]
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          best_seasons?: string[]
          capacity?: number | null
          category?: Database["public"]["Enums"]["mkt_property_category"]
          check_in_time?: string | null
          check_out_time?: string | null
          child_category_slug?: string | null
          constituency?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          county_code?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_source_hash?: string | null
          embedding_updated_at?: string | null
          estate?: string | null
          furnished?: boolean | null
          google_maps_url?: string | null
          id?: string
          is_featured?: boolean
          is_verified?: boolean
          land_size_acres?: number | null
          landmarks?: Json
          latitude?: number | null
          lease_period_months?: number | null
          listing_intent?: string
          longitude?: number | null
          main_image_path?: string | null
          name?: string
          nearby_parks?: string[]
          neighbourhood?: string | null
          occupancy_status?: string | null
          org_id?: string
          parent_category_slug?: string | null
          parking_spaces?: number | null
          postal_address?: string | null
          price_per_night?: number | null
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          rent_daily?: number | null
          rent_monthly?: number | null
          rent_weekly?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_price?: number | null
          secondary_categories?: string[]
          security_deposit?: number | null
          service_charge?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at?: string | null
          sustainability_notes?: string | null
          town?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_properties_county_code_fkey"
            columns: ["county_code"]
            isOneToOne: false
            referencedRelation: "kenya_counties"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "marketplace_properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_property_images: {
        Row: {
          alt_text: string | null
          content_hash: string | null
          created_at: string
          id: string
          property_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          property_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_property_reviews: {
        Row: {
          aspects: Json | null
          body: string
          created_at: string
          id: string
          property_id: string
          rating: number
          reviewer_id: string
          reviewer_name: string
          sentiment: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          aspects?: Json | null
          body: string
          created_at?: string
          id?: string
          property_id: string
          rating: number
          reviewer_id: string
          reviewer_name: string
          sentiment?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          aspects?: Json | null
          body?: string
          created_at?: string
          id?: string
          property_id?: string
          rating?: number
          reviewer_id?: string
          reviewer_name?: string
          sentiment?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_property_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_availability_blocks: {
        Row: {
          booking_id: string | null
          created_at: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
          vehicle_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
          vehicle_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_availability_blocks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_bookings: {
        Row: {
          chauffeur_id: string | null
          created_at: string
          damage_report: Json | null
          delivery_address: string | null
          deposit_kes: number
          driver_option: Database["public"]["Enums"]["mobility_driver_option"]
          dropoff_at: string
          dropoff_location: string | null
          extension_of: string | null
          fuel_end: string | null
          fuel_start: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          guest_user_id: string | null
          id: string
          mileage_end_km: number | null
          mileage_start_km: number | null
          notes: string | null
          org_id: string
          payment_ref: string | null
          payment_status: string
          pickup_at: string
          pickup_location: string | null
          provider_id: string
          provider_responded_at: string | null
          provider_response: string | null
          status: Database["public"]["Enums"]["mobility_booking_status"]
          total_kes: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          chauffeur_id?: string | null
          created_at?: string
          damage_report?: Json | null
          delivery_address?: string | null
          deposit_kes?: number
          driver_option?: Database["public"]["Enums"]["mobility_driver_option"]
          dropoff_at: string
          dropoff_location?: string | null
          extension_of?: string | null
          fuel_end?: string | null
          fuel_start?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_user_id?: string | null
          id?: string
          mileage_end_km?: number | null
          mileage_start_km?: number | null
          notes?: string | null
          org_id: string
          payment_ref?: string | null
          payment_status?: string
          pickup_at: string
          pickup_location?: string | null
          provider_id: string
          provider_responded_at?: string | null
          provider_response?: string | null
          status?: Database["public"]["Enums"]["mobility_booking_status"]
          total_kes: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          chauffeur_id?: string | null
          created_at?: string
          damage_report?: Json | null
          delivery_address?: string | null
          deposit_kes?: number
          driver_option?: Database["public"]["Enums"]["mobility_driver_option"]
          dropoff_at?: string
          dropoff_location?: string | null
          extension_of?: string | null
          fuel_end?: string | null
          fuel_start?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_user_id?: string | null
          id?: string
          mileage_end_km?: number | null
          mileage_start_km?: number | null
          notes?: string | null
          org_id?: string
          payment_ref?: string | null
          payment_status?: string
          pickup_at?: string
          pickup_location?: string | null
          provider_id?: string
          provider_responded_at?: string | null
          provider_response?: string | null
          status?: Database["public"]["Enums"]["mobility_booking_status"]
          total_kes?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_bookings_extension_of_fkey"
            columns: ["extension_of"]
            isOneToOne: false
            referencedRelation: "mobility_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "mobility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_branches: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          county_code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name: string
          operating_hours: Json | null
          org_id: string
          provider_id: string
          town: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          operating_hours?: Json | null
          org_id: string
          provider_id: string
          town?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          operating_hours?: Json | null
          org_id?: string
          provider_id?: string
          town?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_branches_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "mobility_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_maintenance: {
        Row: {
          cost_kes: number | null
          created_at: string
          done_at: string | null
          id: string
          maintenance_type: string
          notes: string | null
          odometer_km: number | null
          org_id: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["mobility_maintenance_status"]
          updated_at: string
          vehicle_id: string
          vendor: string | null
        }
        Insert: {
          cost_kes?: number | null
          created_at?: string
          done_at?: string | null
          id?: string
          maintenance_type: string
          notes?: string | null
          odometer_km?: number | null
          org_id: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["mobility_maintenance_status"]
          updated_at?: string
          vehicle_id: string
          vendor?: string | null
        }
        Update: {
          cost_kes?: number | null
          created_at?: string
          done_at?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          odometer_km?: number | null
          org_id?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["mobility_maintenance_status"]
          updated_at?: string
          vehicle_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobility_maintenance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_owner_payout_requests: {
        Row: {
          amount_kes: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          destination: Json
          external_reference: string | null
          id: string
          method: string
          notes: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          destination?: Json
          external_reference?: string | null
          id?: string
          method?: string
          notes?: string | null
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          destination?: Json
          external_reference?: string | null
          id?: string
          method?: string
          notes?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_owner_payout_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "mobility_private_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_pricing_tiers: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_active: boolean
          min_units: number | null
          notes: string | null
          org_id: string
          price_kes: number
          starts_on: string | null
          tier: Database["public"]["Enums"]["mobility_pricing_tier"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          min_units?: number | null
          notes?: string | null
          org_id: string
          price_kes: number
          starts_on?: string | null
          tier: Database["public"]["Enums"]["mobility_pricing_tier"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          min_units?: number | null
          notes?: string | null
          org_id?: string
          price_kes?: number
          starts_on?: string | null
          tier?: Database["public"]["Enums"]["mobility_pricing_tier"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_pricing_tiers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_pricing_tiers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_private_owners: {
        Row: {
          address: string | null
          bank_details: Json | null
          county_code: string | null
          created_at: string
          email: string | null
          id: string
          id_number: string | null
          kra_pin: string | null
          legal_name: string
          notes: string | null
          phone: string | null
          town: string | null
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: Json | null
          county_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          legal_name: string
          notes?: string | null
          phone?: string | null
          town?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: Json | null
          county_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          legal_name?: string
          notes?: string | null
          phone?: string | null
          town?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      mobility_providers: {
        Row: {
          accepts_private_vehicles: boolean
          address: string | null
          ai_summary: string | null
          bio: string | null
          business_reg_number: string | null
          contact_email: string | null
          contact_phone: string | null
          county_code: string | null
          cover_image_url: string | null
          created_at: string
          emergency_contact: string | null
          id: string
          latitude: number | null
          license_number: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          operating_hours: Json | null
          org_id: string
          policies: string | null
          private_owner_commission_pct: number | null
          private_owner_quality_min: number | null
          rating_avg: number | null
          rating_count: number
          rejection_reason: string | null
          service_areas: Json
          service_categories: string[]
          slug: string
          social: Json | null
          social_links: Json | null
          submitted_at: string | null
          tax_pin: string | null
          terms: string | null
          town: string | null
          updated_at: string
          verification_docs: Json | null
          verification_status: Database["public"]["Enums"]["mobility_status"]
          verified_at: string | null
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          accepts_private_vehicles?: boolean
          address?: string | null
          ai_summary?: string | null
          bio?: string | null
          business_reg_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          emergency_contact?: string | null
          id?: string
          latitude?: number | null
          license_number?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          operating_hours?: Json | null
          org_id: string
          policies?: string | null
          private_owner_commission_pct?: number | null
          private_owner_quality_min?: number | null
          rating_avg?: number | null
          rating_count?: number
          rejection_reason?: string | null
          service_areas?: Json
          service_categories?: string[]
          slug: string
          social?: Json | null
          social_links?: Json | null
          submitted_at?: string | null
          tax_pin?: string | null
          terms?: string | null
          town?: string | null
          updated_at?: string
          verification_docs?: Json | null
          verification_status?: Database["public"]["Enums"]["mobility_status"]
          verified_at?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          accepts_private_vehicles?: boolean
          address?: string | null
          ai_summary?: string | null
          bio?: string | null
          business_reg_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          emergency_contact?: string | null
          id?: string
          latitude?: number | null
          license_number?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          operating_hours?: Json | null
          org_id?: string
          policies?: string | null
          private_owner_commission_pct?: number | null
          private_owner_quality_min?: number | null
          rating_avg?: number | null
          rating_count?: number
          rejection_reason?: string | null
          service_areas?: Json
          service_categories?: string[]
          slug?: string
          social?: Json | null
          social_links?: Json | null
          submitted_at?: string | null
          tax_pin?: string | null
          terms?: string | null
          town?: string | null
          updated_at?: string
          verification_docs?: Json | null
          verification_status?: Database["public"]["Enums"]["mobility_status"]
          verified_at?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mobility_providers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_reviews: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          provider_id: string
          rating: number
          responded_at: string | null
          response: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          provider_id: string
          rating: number
          responded_at?: string | null
          response?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          provider_id?: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "mobility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_reviews_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_seasonal_rates: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          label: string
          price_kes: number
          promo_code: string | null
          starts_on: string
          unit: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          label: string
          price_kes: number
          promo_code?: string | null
          starts_on: string
          unit: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          price_kes?: number
          promo_code?: string | null
          starts_on?: string
          unit?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_seasonal_rates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_vehicle_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["mobility_doc_type"]
          expires_at: string | null
          file_url: string
          id: string
          issued_at: string | null
          notes: string | null
          org_id: string
          title: string | null
          updated_at: string
          vehicle_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["mobility_doc_type"]
          expires_at?: string | null
          file_url: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          org_id: string
          title?: string | null
          updated_at?: string
          vehicle_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["mobility_doc_type"]
          expires_at?: string | null
          file_url?: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          org_id?: string
          title?: string | null
          updated_at?: string
          vehicle_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobility_vehicle_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_vehicle_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          sort_order: number
          url: string
          vehicle_id: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          url: string
          vehicle_id: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_vehicle_rates: {
        Row: {
          created_at: string
          extra_km_kes: number | null
          id: string
          included_km: number | null
          min_units: number
          price_kes: number
          unit: Database["public"]["Enums"]["mobility_rate_unit"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          extra_km_kes?: number | null
          id?: string
          included_km?: number | null
          min_units?: number
          price_kes: number
          unit: Database["public"]["Enums"]["mobility_rate_unit"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          extra_km_kes?: number | null
          id?: string
          included_km?: number | null
          min_units?: number
          price_kes?: number
          unit?: Database["public"]["Enums"]["mobility_rate_unit"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_vehicle_rates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_vehicle_submissions: {
        Row: {
          approved_vehicle_id: string | null
          commission_pct: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          private_owner_id: string
          proposed_daily_rate_kes: number | null
          provider_id: string
          provider_org_id: string
          status: Database["public"]["Enums"]["mobility_submission_status"]
          updated_at: string
          vehicle_snapshot: Json
        }
        Insert: {
          approved_vehicle_id?: string | null
          commission_pct?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          private_owner_id: string
          proposed_daily_rate_kes?: number | null
          provider_id: string
          provider_org_id: string
          status?: Database["public"]["Enums"]["mobility_submission_status"]
          updated_at?: string
          vehicle_snapshot: Json
        }
        Update: {
          approved_vehicle_id?: string | null
          commission_pct?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          private_owner_id?: string
          proposed_daily_rate_kes?: number | null
          provider_id?: string
          provider_org_id?: string
          status?: Database["public"]["Enums"]["mobility_submission_status"]
          updated_at?: string
          vehicle_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mobility_vehicle_submissions_approved_vehicle_id_fkey"
            columns: ["approved_vehicle_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicle_submissions_private_owner_id_fkey"
            columns: ["private_owner_id"]
            isOneToOne: false
            referencedRelation: "mobility_private_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicle_submissions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "mobility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicle_submissions_provider_org_id_fkey"
            columns: ["provider_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_vehicles: {
        Row: {
          accessibility: Json | null
          ai_flags: Json | null
          archived_at: string | null
          body_type: string | null
          category: Database["public"]["Enums"]["mobility_category"]
          chauffeur_available: boolean
          color: string | null
          county_code: string | null
          created_at: string
          delivery_fee_kes: number | null
          deposit_kes: number | null
          description: string | null
          doors: number | null
          drive_type: string | null
          drive_type_ext: string | null
          dropoff_locations: Json
          embedding: string | null
          engine_size: string | null
          extra_km_kes: number | null
          features: Json | null
          fleet_no: string | null
          fuel_policy: string | null
          fuel_type: string | null
          has_ac: boolean
          has_bluetooth: boolean | null
          has_child_seat: boolean | null
          has_gps: boolean
          id: string
          instant_book: boolean
          insurance: Json | null
          insurance_info: Json
          is_archived: boolean
          is_electric: boolean
          is_featured: boolean
          is_hybrid: boolean
          is_luxury: boolean
          is_safari: boolean
          is_wedding: boolean
          license_requirements: string | null
          luggage: number | null
          main_image_url: string | null
          make: string
          mileage_km: number | null
          mileage_limit_km_per_day: number | null
          mileage_policy: string | null
          min_driver_age: number | null
          min_rental_hours: number | null
          model: string
          org_id: string
          owner_type: Database["public"]["Enums"]["mobility_owner_type"]
          pickup_locations: Json
          private_owner_id: string | null
          promo_price_kes: number | null
          provider_id: string
          quality_score: number | null
          rating_avg: number | null
          rating_count: number
          registration_plate: string | null
          seats: number | null
          security_deposit_kes: number | null
          self_drive_available: boolean
          slug: string
          status: Database["public"]["Enums"]["mobility_status"]
          submission_id: string | null
          town: string | null
          transmission: string | null
          trim: string | null
          updated_at: string
          variant: string | null
          vehicle_type: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          accessibility?: Json | null
          ai_flags?: Json | null
          archived_at?: string | null
          body_type?: string | null
          category: Database["public"]["Enums"]["mobility_category"]
          chauffeur_available?: boolean
          color?: string | null
          county_code?: string | null
          created_at?: string
          delivery_fee_kes?: number | null
          deposit_kes?: number | null
          description?: string | null
          doors?: number | null
          drive_type?: string | null
          drive_type_ext?: string | null
          dropoff_locations?: Json
          embedding?: string | null
          engine_size?: string | null
          extra_km_kes?: number | null
          features?: Json | null
          fleet_no?: string | null
          fuel_policy?: string | null
          fuel_type?: string | null
          has_ac?: boolean
          has_bluetooth?: boolean | null
          has_child_seat?: boolean | null
          has_gps?: boolean
          id?: string
          instant_book?: boolean
          insurance?: Json | null
          insurance_info?: Json
          is_archived?: boolean
          is_electric?: boolean
          is_featured?: boolean
          is_hybrid?: boolean
          is_luxury?: boolean
          is_safari?: boolean
          is_wedding?: boolean
          license_requirements?: string | null
          luggage?: number | null
          main_image_url?: string | null
          make: string
          mileage_km?: number | null
          mileage_limit_km_per_day?: number | null
          mileage_policy?: string | null
          min_driver_age?: number | null
          min_rental_hours?: number | null
          model: string
          org_id: string
          owner_type?: Database["public"]["Enums"]["mobility_owner_type"]
          pickup_locations?: Json
          private_owner_id?: string | null
          promo_price_kes?: number | null
          provider_id: string
          quality_score?: number | null
          rating_avg?: number | null
          rating_count?: number
          registration_plate?: string | null
          seats?: number | null
          security_deposit_kes?: number | null
          self_drive_available?: boolean
          slug: string
          status?: Database["public"]["Enums"]["mobility_status"]
          submission_id?: string | null
          town?: string | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          variant?: string | null
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          accessibility?: Json | null
          ai_flags?: Json | null
          archived_at?: string | null
          body_type?: string | null
          category?: Database["public"]["Enums"]["mobility_category"]
          chauffeur_available?: boolean
          color?: string | null
          county_code?: string | null
          created_at?: string
          delivery_fee_kes?: number | null
          deposit_kes?: number | null
          description?: string | null
          doors?: number | null
          drive_type?: string | null
          drive_type_ext?: string | null
          dropoff_locations?: Json
          embedding?: string | null
          engine_size?: string | null
          extra_km_kes?: number | null
          features?: Json | null
          fleet_no?: string | null
          fuel_policy?: string | null
          fuel_type?: string | null
          has_ac?: boolean
          has_bluetooth?: boolean | null
          has_child_seat?: boolean | null
          has_gps?: boolean
          id?: string
          instant_book?: boolean
          insurance?: Json | null
          insurance_info?: Json
          is_archived?: boolean
          is_electric?: boolean
          is_featured?: boolean
          is_hybrid?: boolean
          is_luxury?: boolean
          is_safari?: boolean
          is_wedding?: boolean
          license_requirements?: string | null
          luggage?: number | null
          main_image_url?: string | null
          make?: string
          mileage_km?: number | null
          mileage_limit_km_per_day?: number | null
          mileage_policy?: string | null
          min_driver_age?: number | null
          min_rental_hours?: number | null
          model?: string
          org_id?: string
          owner_type?: Database["public"]["Enums"]["mobility_owner_type"]
          pickup_locations?: Json
          private_owner_id?: string | null
          promo_price_kes?: number | null
          provider_id?: string
          quality_score?: number | null
          rating_avg?: number | null
          rating_count?: number
          registration_plate?: string | null
          seats?: number | null
          security_deposit_kes?: number | null
          self_drive_available?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["mobility_status"]
          submission_id?: string | null
          town?: string | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          variant?: string | null
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mobility_vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicles_private_owner_id_fkey"
            columns: ["private_owner_id"]
            isOneToOne: false
            referencedRelation: "mobility_private_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicles_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "mobility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobility_vehicles_submission_fk"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "mobility_vehicle_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount: number | null
          checkout_request_id: string
          created_at: string
          id: string
          invoice_id: string | null
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          org_id: string | null
          phone_number: string | null
          raw_payload: Json | null
          reservation_id: string | null
          result_code: number | null
          result_desc: string | null
          status: string
          subscription_id: string | null
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          checkout_request_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          org_id?: string | null
          phone_number?: string | null
          raw_payload?: Json | null
          reservation_id?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          subscription_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          checkout_request_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          org_id?: string | null
          phone_number?: string | null
          raw_payload?: Json | null
          reservation_id?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          subscription_id?: string | null
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_drafts: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json
          property_id: string | null
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload?: Json
          property_id?: string | null
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          property_id?: string | null
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      org_counters: {
        Row: {
          invoice_seq: number
          org_id: string
        }
        Insert: {
          invoice_seq?: number
          org_id: string
        }
        Update: {
          invoice_seq?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_permissions: {
        Row: {
          effect: string
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string
          permission: string
          user_id: string
        }
        Insert: {
          effect?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id: string
          permission: string
          user_id: string
        }
        Update: {
          effect?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          ical_access_log_retention_days: number
          ical_incident_retention_days: number
          id: string
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ical_access_log_retention_days?: number
          ical_incident_retention_days?: number
          id?: string
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ical_access_log_retention_days?: number
          ical_incident_retention_days?: number
          id?: string
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          lifetime_earned: number
          lifetime_paid_out: number
          org_id: string
          payout_destination: Json
          payout_method: string
          pending_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          lifetime_earned?: number
          lifetime_paid_out?: number
          org_id: string
          payout_destination?: Json
          payout_method?: string
          pending_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          lifetime_earned?: number
          lifetime_paid_out?: number
          org_id?: string
          payout_destination?: Json
          payout_method?: string
          pending_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_wallets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          destination: Json
          external_reference: string | null
          failure_reason: string | null
          id: string
          method: string
          notes: string | null
          org_id: string
          processed_at: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          destination?: Json
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          org_id: string
          processed_at?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          destination?: Json
          external_reference?: string | null
          failure_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          org_id?: string
          processed_at?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "owner_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_sessions: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          messages: Json
          module: string
          plan: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs?: Json
          messages?: Json
          module: string
          plan?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          messages?: Json
          module?: string
          plan?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_tax_rates: {
        Row: {
          active: boolean
          applies_to: string[]
          code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          notes: string | null
          rate_percent: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          code: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          notes?: string | null
          rate_percent?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          notes?: string | null
          rate_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_signals: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          observed_on: string
          org_id: string | null
          payload: Json
          price_amount: number | null
          property_id: string | null
          region_code: string | null
          signal_type: string
          source: string | null
          valid_until: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          observed_on: string
          org_id?: string | null
          payload?: Json
          price_amount?: number | null
          property_id?: string | null
          region_code?: string | null
          signal_type: string
          source?: string | null
          valid_until?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          observed_on?: string
          org_id?: string | null
          payload?: Json
          price_amount?: number | null
          property_id?: string | null
          region_code?: string | null
          signal_type?: string
          source?: string | null
          valid_until?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_org_id: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_org_id_fkey"
            columns: ["current_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          timezone: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          timezone?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          timezone?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_category_nodes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          legacy_category: string | null
          metadata: Json
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          legacy_category?: string | null
          metadata?: Json
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          legacy_category?: string | null
          metadata?: Json
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_category_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "property_category_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      property_claims: {
        Row: {
          claimant_email: string
          claimant_id: string | null
          claimant_phone: string | null
          created_at: string
          discovered_id: string
          id: string
          proof_notes: string | null
          status: string
          updated_at: string
          verification_attempts: number
          verification_code_hash: string | null
          verification_expires_at: string | null
          verified_at: string | null
        }
        Insert: {
          claimant_email: string
          claimant_id?: string | null
          claimant_phone?: string | null
          created_at?: string
          discovered_id: string
          id?: string
          proof_notes?: string | null
          status?: string
          updated_at?: string
          verification_attempts?: number
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Update: {
          claimant_email?: string
          claimant_id?: string | null
          claimant_phone?: string | null
          created_at?: string
          discovered_id?: string
          id?: string
          proof_notes?: string | null
          status?: string
          updated_at?: string
          verification_attempts?: number
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_claims_discovered_id_fkey"
            columns: ["discovered_id"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_claims_discovered_id_fkey"
            columns: ["discovered_id"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_merge_audit: {
        Row: {
          created_at: string
          diff: Json
          duplicate_id: string | null
          id: string
          performed_by: string | null
          primary_id: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          diff?: Json
          duplicate_id?: string | null
          id?: string
          performed_by?: string | null
          primary_id?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          diff?: Json
          duplicate_id?: string | null
          id?: string
          performed_by?: string | null
          primary_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_merge_audit_duplicate_id_fkey"
            columns: ["duplicate_id"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_merge_audit_duplicate_id_fkey"
            columns: ["duplicate_id"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_merge_audit_primary_id_fkey"
            columns: ["primary_id"]
            isOneToOne: false
            referencedRelation: "discovered_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_merge_audit_primary_id_fkey"
            columns: ["primary_id"]
            isOneToOne: false
            referencedRelation: "public_discovered_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          key: string | null
          user_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          key?: string | null
          user_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          key?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rbac_permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      rbac_role_defaults: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_defaults_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      recommendation_events: {
        Row: {
          context: Json
          created_at: string
          event_type: string
          id: string
          property_id: string
          session_id: string | null
          user_id: string | null
          weight: number
        }
        Insert: {
          context?: Json
          created_at?: string
          event_type: string
          id?: string
          property_id: string
          session_id?: string | null
          user_id?: string | null
          weight?: number
        }
        Update: {
          context?: Json
          created_at?: string
          event_type?: string
          id?: string
          property_id?: string
          session_id?: string | null
          user_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "marketplace_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          check_in: string
          check_out: string
          children: number
          confirmation_code: string
          created_at: string
          currency: string
          guest_id: string
          id: string
          notes: string | null
          org_id: string
          property_id: string
          source: Database["public"]["Enums"]["reservation_source"]
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          adults?: number
          check_in: string
          check_out: string
          children?: number
          confirmation_code?: string
          created_at?: string
          currency?: string
          guest_id: string
          id?: string
          notes?: string | null
          org_id: string
          property_id: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          adults?: number
          check_in?: string
          check_out?: string
          children?: number
          confirmation_code?: string
          created_at?: string
          currency?: string
          guest_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          property_id?: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      review_ai_analysis: {
        Row: {
          aspects: Json
          created_at: string
          id: string
          model_version: string | null
          review_id: string
          risk_flags: string[]
          sentiment: number
          summary: string | null
        }
        Insert: {
          aspects?: Json
          created_at?: string
          id?: string
          model_version?: string | null
          review_id: string
          risk_flags?: string[]
          sentiment?: number
          summary?: string | null
        }
        Update: {
          aspects?: Json
          created_at?: string
          id?: string
          model_version?: string | null
          review_id?: string
          risk_flags?: string[]
          sentiment?: number
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_ai_analysis_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "marketplace_property_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_user_id: string | null
          amount_kes: number | null
          created_at: string
          event_type: string
          from_plan: string | null
          id: string
          org_id: string
          payload: Json
          reason: string | null
          subscription_id: string | null
          to_plan: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount_kes?: number | null
          created_at?: string
          event_type: string
          from_plan?: string | null
          id?: string
          org_id: string
          payload?: Json
          reason?: string | null
          subscription_id?: string | null
          to_plan?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount_kes?: number | null
          created_at?: string
          event_type?: string
          from_plan?: string | null
          id?: string
          org_id?: string
          payload?: Json
          reason?: string | null
          subscription_id?: string | null
          to_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_notices: {
        Row: {
          id: string
          notice_type: string
          sent_at: string
          subscription_id: string
        }
        Insert: {
          id?: string
          notice_type: string
          sent_at?: string
          subscription_id: string
        }
        Update: {
          id?: string
          notice_type?: string
          sent_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_notices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          ai_calls_per_month: number | null
          code: string
          created_at: string
          feature_flags: Json
          has_api_access: boolean
          has_channel_manager: boolean
          has_dynamic_pricing: boolean
          has_priority_support: boolean
          has_promotional_boost: boolean
          id: string
          is_contact_sales: boolean
          name: string
          photo_limit_per_property: number | null
          price_monthly_kes: number
          price_yearly_kes: number
          property_limit: number | null
          sort_order: number
          storage_mb: number | null
          tagline: string | null
          team_member_limit: number | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_calls_per_month?: number | null
          code: string
          created_at?: string
          feature_flags?: Json
          has_api_access?: boolean
          has_channel_manager?: boolean
          has_dynamic_pricing?: boolean
          has_priority_support?: boolean
          has_promotional_boost?: boolean
          id?: string
          is_contact_sales?: boolean
          name: string
          photo_limit_per_property?: number | null
          price_monthly_kes?: number
          price_yearly_kes?: number
          property_limit?: number | null
          sort_order?: number
          storage_mb?: number | null
          tagline?: string | null
          team_member_limit?: number | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_calls_per_month?: number | null
          code?: string
          created_at?: string
          feature_flags?: Json
          has_api_access?: boolean
          has_channel_manager?: boolean
          has_dynamic_pricing?: boolean
          has_priority_support?: boolean
          has_promotional_boost?: boolean
          id?: string
          is_contact_sales?: boolean
          name?: string
          photo_limit_per_property?: number | null
          price_monthly_kes?: number
          price_yearly_kes?: number
          property_limit?: number | null
          sort_order?: number
          storage_mb?: number | null
          tagline?: string | null
          team_member_limit?: number | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          mpesa_amount_kes: number | null
          mpesa_checkout_request_id: string | null
          mpesa_merchant_request_id: string | null
          mpesa_phone: string | null
          mpesa_receipt_number: string | null
          org_id: string
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_subscription_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          mpesa_amount_kes?: number | null
          mpesa_checkout_request_id?: string | null
          mpesa_merchant_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt_number?: string | null
          org_id: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          mpesa_amount_kes?: number | null
          mpesa_checkout_request_id?: string | null
          mpesa_merchant_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt_number?: string | null
          org_id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_bookings: {
        Row: {
          created_at: string
          currency: string
          departure_id: string
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          guests_count: number
          id: string
          notes: string | null
          org_id: string
          status: string
          total_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          departure_id: string
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          org_id: string
          status?: string
          total_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          departure_id?: string
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          org_id?: string
          status?: string
          total_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_bookings_departure_id_fkey"
            columns: ["departure_id"]
            isOneToOne: false
            referencedRelation: "tour_departures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_departure_guides: {
        Row: {
          created_at: string
          departure_id: string
          guide_id: string
          id: string
          org_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          departure_id: string
          guide_id: string
          id?: string
          org_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          departure_id?: string
          guide_id?: string
          id?: string
          org_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_departure_guides_departure_id_fkey"
            columns: ["departure_id"]
            isOneToOne: false
            referencedRelation: "tour_departures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_departure_guides_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "tour_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_departure_guides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_departures: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          notes: string | null
          org_id: string
          package_id: string
          price_cents_override: number | null
          seats_sold: number
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          notes?: string | null
          org_id: string
          package_id: string
          price_cents_override?: number | null
          seats_sold?: number
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          notes?: string | null
          org_id?: string
          package_id?: string
          price_cents_override?: number | null
          seats_sold?: number
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_departures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_departures_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "tour_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_guides: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          email: string | null
          id: string
          languages: string[]
          name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          languages?: string[]
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          languages?: string[]
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_guides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_packages: {
        Row: {
          active: boolean
          base_price_cents: number
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          id: string
          max_capacity: number
          name: string
          org_id: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          max_capacity?: number
          name: string
          org_id: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          max_capacity?: number
          name?: string
          org_id?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_packages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_seasonal_rates: {
        Row: {
          created_at: string
          currency: string
          end_date: string
          id: string
          label: string
          price: number
          start_date: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          end_date: string
          id?: string
          label: string
          price: number
          start_date: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          end_date?: string
          id?: string
          label?: string
          price?: number
          start_date?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_seasonal_rates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          base_price: number
          capacity: number
          created_at: string
          ical_export_token: string
          ical_export_token_created_at: string | null
          ical_export_token_expires_at: string | null
          id: string
          name: string
          org_id: string
          property_id: string
          status: Database["public"]["Enums"]["unit_status"]
          type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          base_price?: number
          capacity?: number
          created_at?: string
          ical_export_token?: string
          ical_export_token_created_at?: string | null
          ical_export_token_expires_at?: string | null
          id?: string
          name: string
          org_id: string
          property_id: string
          status?: Database["public"]["Enums"]["unit_status"]
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          capacity?: number
          created_at?: string
          ical_export_token?: string
          ical_export_token_created_at?: string | null
          ical_export_token_expires_at?: string | null
          id?: string
          name?: string
          org_id?: string
          property_id?: string
          status?: Database["public"]["Enums"]["unit_status"]
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preference_vectors: {
        Row: {
          embedding: string | null
          signals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          embedding?: string | null
          signals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          embedding?: string | null
          signals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount: number
          available_after: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_type: string
          id: string
          org_id: string
          pending_after: number
          reference_id: string | null
          reference_type: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          available_after: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type: string
          id?: string
          org_id: string
          pending_after: number
          reference_id?: string | null
          reference_type?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          available_after?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          org_id?: string
          pending_after?: number
          reference_id?: string | null
          reference_type?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "owner_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_discovered_properties: {
        Row: {
          address: string | null
          ai_description: string | null
          amenities: string[] | null
          county_code: string | null
          created_at: string | null
          id: string | null
          keywords: string[] | null
          latitude: number | null
          longitude: number | null
          name: string | null
          property_type: string | null
          quality_score: number | null
          slug: string | null
          status: string | null
          tags: string[] | null
          town: string | null
          updated_at: string | null
          ward: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_description?: string | null
          amenities?: string[] | null
          county_code?: string | null
          created_at?: string | null
          id?: string | null
          keywords?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          property_type?: string | null
          quality_score?: number | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          town?: string | null
          updated_at?: string | null
          ward?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_description?: string | null
          amenities?: string[] | null
          county_code?: string | null
          created_at?: string | null
          id?: string | null
          keywords?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          property_type?: string | null
          quality_score?: number | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          town?: string | null
          updated_at?: string | null
          ward?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organization_invitation: {
        Args: { _token: string }
        Returns: string
      }
      accept_organization_invitation_for: {
        Args: { _token: string; _user_id: string }
        Returns: string
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          org_id: string
          org_name: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _org_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      match_marketplace_properties: {
        Args: {
          match_count?: number
          only_approved?: boolean
          query_embedding: string
        }
        Returns: {
          category: string
          county_code: string
          description: string
          id: string
          name: string
          similarity: number
          slug: string
          town: string
        }[]
      }
      next_invoice_number:
        | { Args: { _org_id: string }; Returns: string }
        | { Args: { _org_id: string; _user_id: string }; Returns: string }
      org_has_active_subscription: {
        Args: { _org_id: string }
        Returns: boolean
      }
      recommend_for_user: {
        Args: { match_count?: number; p_session_id?: string; p_user_id: string }
        Returns: {
          category: string
          county_code: string
          description: string
          id: string
          name: string
          similarity: number
          slug: string
          town: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      similar_properties: {
        Args: { match_count?: number; p_property_id: string }
        Returns: {
          category: string
          county_code: string
          description: string
          id: string
          name: string
          similarity: number
          slug: string
          town: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin" | "support"
      commission_scope: "global" | "county" | "category" | "property" | "org"
      invoice_status: "draft" | "sent" | "paid" | "void" | "overdue"
      marketplace_booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
      mkt_availability: "available" | "limited" | "booked_out"
      mkt_listing_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "archived"
      mkt_property_category:
        | "hotel"
        | "resort"
        | "lodge"
        | "camp"
        | "guest_house"
        | "serviced_apartment"
        | "airbnb"
        | "villa"
        | "bnb"
        | "boutique_hotel"
        | "holiday_home"
        | "hostel"
        | "conservancy"
        | "ranch"
        | "safari_camp"
        | "luxury_tented_camp"
        | "eco_lodge"
        | "campsite"
        | "glamping"
        | "mountain_lodge"
        | "beach_villa"
        | "lakefront_property"
        | "forest_retreat"
        | "conference_centre"
        | "wedding_venue"
        | "corporate_retreat"
        | "team_building_venue"
        | "wellness_retreat"
        | "bedsitter"
        | "single_room"
        | "studio"
        | "one_bedroom"
        | "two_bedroom"
        | "three_bedroom"
        | "four_bedroom"
        | "apartment"
        | "flat"
        | "maisonette"
        | "townhouse"
        | "standalone_house"
        | "bungalow"
        | "duplex"
        | "penthouse"
        | "gated_community_home"
        | "student_hostel"
        | "staff_housing"
        | "senior_living"
        | "cottage"
        | "office_space"
        | "shop"
        | "retail_space"
        | "warehouse"
        | "godown"
        | "industrial_building"
        | "business_park"
        | "coworking_space"
        | "hotel_for_sale"
        | "restaurant_lease"
        | "farm"
        | "agricultural_land"
        | "tea_farm"
        | "coffee_farm"
        | "flower_farm"
        | "dairy_farm"
        | "poultry_farm"
        | "fish_farm"
        | "residential_plot"
        | "commercial_plot"
        | "industrial_plot"
        | "beach_plot"
        | "lakefront_plot"
        | "riverfront_plot"
      mobility_booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "refunded"
      mobility_category:
        | "self_drive"
        | "chauffeur"
        | "airport_transfer"
        | "executive"
        | "tour_van"
        | "safari_4x4"
        | "luxury"
        | "wedding"
        | "shuttle"
        | "bus"
        | "motorcycle"
        | "bicycle"
        | "boat"
      mobility_doc_type:
        | "insurance"
        | "inspection"
        | "logbook"
        | "roadworthiness"
        | "service_history"
        | "compliance"
        | "other"
      mobility_driver_option: "self" | "chauffeur"
      mobility_maintenance_status:
        | "scheduled"
        | "in_progress"
        | "done"
        | "cancelled"
      mobility_owner_type: "company" | "private"
      mobility_pricing_tier:
        | "daily"
        | "weekend"
        | "weekly"
        | "monthly"
        | "lease"
        | "corporate"
        | "holiday"
        | "peak"
        | "promo"
      mobility_rate_unit: "hour" | "day" | "week" | "month"
      mobility_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "archived"
      mobility_submission_status:
        | "pending"
        | "approved"
        | "rejected"
        | "withdrawn"
      org_role:
        | "owner"
        | "admin"
        | "manager"
        | "staff"
        | "enterprise_admin"
        | "guest"
      payout_status:
        | "requested"
        | "approved"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      property_type:
        | "hotel"
        | "lodge"
        | "resort"
        | "vacation_rental"
        | "airbnb"
        | "tour_operator"
      reservation_source:
        | "direct"
        | "airbnb"
        | "booking_com"
        | "vrbo"
        | "expedia"
        | "other"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      subscription_plan: "starter" | "professional" | "business" | "enterprise"
      unit_status:
        | "available"
        | "occupied"
        | "maintenance"
        | "cleaning"
        | "blocked"
      unit_type:
        | "room"
        | "suite"
        | "cabin"
        | "apartment"
        | "villa"
        | "tour_slot"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "super_admin", "support"],
      commission_scope: ["global", "county", "category", "property", "org"],
      invoice_status: ["draft", "sent", "paid", "void", "overdue"],
      marketplace_booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
      ],
      mkt_availability: ["available", "limited", "booked_out"],
      mkt_listing_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "archived",
      ],
      mkt_property_category: [
        "hotel",
        "resort",
        "lodge",
        "camp",
        "guest_house",
        "serviced_apartment",
        "airbnb",
        "villa",
        "bnb",
        "boutique_hotel",
        "holiday_home",
        "hostel",
        "conservancy",
        "ranch",
        "safari_camp",
        "luxury_tented_camp",
        "eco_lodge",
        "campsite",
        "glamping",
        "mountain_lodge",
        "beach_villa",
        "lakefront_property",
        "forest_retreat",
        "conference_centre",
        "wedding_venue",
        "corporate_retreat",
        "team_building_venue",
        "wellness_retreat",
        "bedsitter",
        "single_room",
        "studio",
        "one_bedroom",
        "two_bedroom",
        "three_bedroom",
        "four_bedroom",
        "apartment",
        "flat",
        "maisonette",
        "townhouse",
        "standalone_house",
        "bungalow",
        "duplex",
        "penthouse",
        "gated_community_home",
        "student_hostel",
        "staff_housing",
        "senior_living",
        "cottage",
        "office_space",
        "shop",
        "retail_space",
        "warehouse",
        "godown",
        "industrial_building",
        "business_park",
        "coworking_space",
        "hotel_for_sale",
        "restaurant_lease",
        "farm",
        "agricultural_land",
        "tea_farm",
        "coffee_farm",
        "flower_farm",
        "dairy_farm",
        "poultry_farm",
        "fish_farm",
        "residential_plot",
        "commercial_plot",
        "industrial_plot",
        "beach_plot",
        "lakefront_plot",
        "riverfront_plot",
      ],
      mobility_booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "refunded",
      ],
      mobility_category: [
        "self_drive",
        "chauffeur",
        "airport_transfer",
        "executive",
        "tour_van",
        "safari_4x4",
        "luxury",
        "wedding",
        "shuttle",
        "bus",
        "motorcycle",
        "bicycle",
        "boat",
      ],
      mobility_doc_type: [
        "insurance",
        "inspection",
        "logbook",
        "roadworthiness",
        "service_history",
        "compliance",
        "other",
      ],
      mobility_driver_option: ["self", "chauffeur"],
      mobility_maintenance_status: [
        "scheduled",
        "in_progress",
        "done",
        "cancelled",
      ],
      mobility_owner_type: ["company", "private"],
      mobility_pricing_tier: [
        "daily",
        "weekend",
        "weekly",
        "monthly",
        "lease",
        "corporate",
        "holiday",
        "peak",
        "promo",
      ],
      mobility_rate_unit: ["hour", "day", "week", "month"],
      mobility_status: ["draft", "pending", "approved", "rejected", "archived"],
      mobility_submission_status: [
        "pending",
        "approved",
        "rejected",
        "withdrawn",
      ],
      org_role: [
        "owner",
        "admin",
        "manager",
        "staff",
        "enterprise_admin",
        "guest",
      ],
      payout_status: [
        "requested",
        "approved",
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
      property_type: [
        "hotel",
        "lodge",
        "resort",
        "vacation_rental",
        "airbnb",
        "tour_operator",
      ],
      reservation_source: [
        "direct",
        "airbnb",
        "booking_com",
        "vrbo",
        "expedia",
        "other",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      subscription_plan: ["starter", "professional", "business", "enterprise"],
      unit_status: [
        "available",
        "occupied",
        "maintenance",
        "cleaning",
        "blocked",
      ],
      unit_type: [
        "room",
        "suite",
        "cabin",
        "apartment",
        "villa",
        "tour_slot",
        "other",
      ],
    },
  },
} as const
