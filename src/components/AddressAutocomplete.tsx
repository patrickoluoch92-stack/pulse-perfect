import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { placesAutocomplete, placeDetails } from "@/lib/places.functions";
import { MapPin, Loader2 } from "lucide-react";

export type PlaceSelection = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUri: string | null;
  town: string;
  county: string;
  countryCode: string;
};

type Props = {
  defaultValue?: string;
  placeholder?: string;
  onSelect: (place: PlaceSelection) => void;
};

function newToken() {
  return (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now();
}

export function AddressAutocomplete({ defaultValue = "", placeholder, onSelect }: Props) {
  const autocomplete = useServerFn(placesAutocomplete);
  const details = useServerFn(placeDetails);

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; mainText: string; secondaryText: string; description: string }>
  >([]);
  const sessionToken = useMemo(() => newToken(), []);
  const debounceRef = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await autocomplete({ data: { input: value, sessionToken } });
        setSuggestions(res.suggestions);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, autocomplete, sessionToken]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function pick(placeId: string, label: string) {
    setValue(label);
    setOpen(false);
    setLoading(true);
    try {
      const place = await details({ data: { placeId, sessionToken } });
      onSelect(place);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search an address or place"}
          className="pl-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() =>
                  pick(s.placeId, s.description || `${s.mainText} ${s.secondaryText}`.trim())
                }
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium">{s.mainText || s.description}</span>
                {s.secondaryText && (
                  <span className="text-xs text-muted-foreground">{s.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
