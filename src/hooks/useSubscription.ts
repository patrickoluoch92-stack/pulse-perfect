import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export function useSubscription(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["subscription", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const env = getPaddleEnvironment();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("org_id", orgId!)
        .in("environment", [env, env === "sandbox" ? "sandbox" : "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
