// contexts/OutletContext.tsx
import { useDatabase } from "@/contexts/DatabaseContext";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface Outlet {
  id: string;
  name: string;
}

interface OutletContextType {
  outlets: Outlet[];
  selectedOutlet: Outlet | null;
  setSelectedOutletId: (id: string) => void;
  loading: boolean;
  refetchOutlets: () => Promise<void>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { supabase, config } = useDatabase();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchOutlets = useCallback(async () => {
    // 1. If DB client is not initialized yet (startup or unconfigured), exit gracefully
    if (!supabase || !config) {
      setOutlets([]);
      setSelectedOutletId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("outlets")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.warn("⚠️ Error fetching outlets:", error.message);
        setOutlets([]);
      } else if (data) {
        setOutlets(data);
        // Default to first outlet if none currently selected or selected ID is invalid
        if (
          data.length > 0 &&
          (!selectedOutletId || !data.some((o) => o.id === selectedOutletId))
        ) {
          setSelectedOutletId(data[0].id);
        }
      }
    } catch (err) {
      console.error("❌ Unexpected error fetching outlets:", err);
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, config, selectedOutletId]);

  // 2. Automatically re-fetch whenever supabase instance or property config changes
  useEffect(() => {
    fetchOutlets();
  }, [supabase, config]);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || null;

  return (
    <OutletContext.Provider
      value={{
        outlets,
        selectedOutlet,
        setSelectedOutletId,
        loading,
        refetchOutlets: fetchOutlets,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export const useOutlet = () => {
  const context = useContext(OutletContext);
  if (!context)
    throw new Error("useOutlet must be used within an OutletProvider");
  return context;
};
