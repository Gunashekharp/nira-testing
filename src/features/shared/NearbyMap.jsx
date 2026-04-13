import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Hospital, Pill, Phone, Clock, Star, ExternalLink } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/utils";

const MOCK_PLACES = {
  hospitals: [
    { id: 1, name: "Apollo Hospital", address: "21 Greams Ln, Chennai", distance: "1.2 km", rating: 4.5, phone: "+91-44-2829-0200", open: true, type: "Multi-Specialty" },
    { id: 2, name: "Fortis Malar Hospital", address: "52 1st Main Rd, Chennai", distance: "2.8 km", rating: 4.3, phone: "+91-44-4289-2222", open: true, type: "Multi-Specialty" },
    { id: 3, name: "MIOT International", address: "4/112 Mount Poonamallee Rd", distance: "5.1 km", rating: 4.6, phone: "+91-44-4200-0000", open: true, type: "Super-Specialty" },
    { id: 4, name: "Sri Ramachandra Hospital", address: "1 Ramachandra Nagar, Porur", distance: "8.3 km", rating: 4.4, phone: "+91-44-4592-8500", open: false, type: "Teaching Hospital" },
  ],
  pharmacies: [
    { id: 5, name: "Apollo Pharmacy", address: "15 Anna Salai, Chennai", distance: "0.5 km", rating: 4.2, phone: "+91-44-3989-8989", open: true, type: "24/7 Pharmacy" },
    { id: 6, name: "MedPlus", address: "7 TTK Road, Alwarpet", distance: "1.1 km", rating: 4.0, phone: "+91-44-4857-4857", open: true, type: "Retail Pharmacy" },
    { id: 7, name: "Netmeds Store", address: "23 Nungambakkam High Rd", distance: "2.4 km", rating: 3.9, phone: "+91-44-4000-4000", open: false, type: "Online + Store" },
  ],
};

function PlaceCard({ place }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/60 bg-white/70 p-4 shadow-soft hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{place.name}</span>
            {place.open ? (
              <Badge tone="success">Open</Badge>
            ) : (
              <Badge tone="danger">Closed</Badge>
            )}
          </div>
          <div className="text-xs text-muted mt-1">{place.address}</div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted">
              <Navigation className="h-3 w-3" /> {place.distance}
            </span>
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Star className="h-3 w-3 fill-amber-400" /> {place.rating}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3 w-3" /> {place.type}
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <a
            href={`tel:${place.phone}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export function NearbyMap() {
  const [tab, setTab] = useState("hospitals");
  const places = MOCK_PLACES[tab] || [];

  return (
    <Card className="p-6">
      <CardHeader
        eyebrow="Location Services"
        title="Nearby Healthcare"
        description="Find hospitals, pharmacies, and diagnostic centers near you."
      />

      {/* Map placeholder */}
      <div className="relative mb-5 h-48 overflow-hidden rounded-xl border border-white/60 bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 gap-px opacity-20">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="bg-brand-tide/20 rounded" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-8 w-8 text-brand-tide mx-auto mb-2 animate-bounce" />
            <div className="text-sm font-semibold text-brand-midnight">Chennai, Tamil Nadu</div>
            <div className="text-xs text-muted">Your approximate location</div>
          </div>
        </div>
        {/* Place markers */}
        {places.slice(0, 3).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.15 }}
            className="absolute"
            style={{ top: `${20 + i * 25}%`, left: `${15 + i * 25}%` }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg">
              {i + 1}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === "hospitals" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("hospitals")}
        >
          <Hospital className="h-3.5 w-3.5 mr-1" /> Hospitals
        </Button>
        <Button
          variant={tab === "pharmacies" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("pharmacies")}
        >
          <Pill className="h-3.5 w-3.5 mr-1" /> Pharmacies
        </Button>
      </div>

      {/* Place list */}
      <div className="space-y-3">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </Card>
  );
}
