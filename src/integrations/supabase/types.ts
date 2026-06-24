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
          amenities: string[]
          availability: Database["public"]["Enums"]["mkt_availability"]
          category: Database["public"]["Enums"]["mkt_property_category"]
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          county_code: string
          created_at: string
          created_by: string
          currency: string
          description: string
          google_maps_url: string | null
          id: string
          is_featured: boolean
          latitude: number | null
          longitude: number | null
          main_image_path: string | null
          name: string
          org_id: string
          price_per_night: number | null
          rating_avg: number
          rating_count: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at: string | null
          town: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          availability?: Database["public"]["Enums"]["mkt_availability"]
          category: Database["public"]["Enums"]["mkt_property_category"]
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          county_code: string
          created_at?: string
          created_by: string
          currency?: string
          description: string
          google_maps_url?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          main_image_path?: string | null
          name: string
          org_id: string
          price_per_night?: number | null
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at?: string | null
          town: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          availability?: Database["public"]["Enums"]["mkt_availability"]
          category?: Database["public"]["Enums"]["mkt_property_category"]
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          county_code?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          google_maps_url?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          main_image_path?: string | null
          name?: string
          org_id?: string
          price_per_night?: number | null
          rating_avg?: number
          rating_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["mkt_listing_status"]
          submitted_at?: string | null
          town?: string
          updated_at?: string
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
          created_at: string
          id: string
          property_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
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
          body: string
          created_at: string
          id: string
          property_id: string
          rating: number
          reviewer_id: string
          reviewer_name: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          property_id: string
          rating: number
          reviewer_id: string
          reviewer_name: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          property_id?: string
          rating?: number
          reviewer_id?: string
          reviewer_name?: string
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { _token: string }
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
      next_invoice_number: { Args: { _org_id: string }; Returns: string }
      org_has_active_subscription: {
        Args: { _org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      org_role: "owner" | "admin" | "manager" | "staff"
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
      app_role: ["admin", "moderator", "user"],
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
      ],
      org_role: ["owner", "admin", "manager", "staff"],
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
