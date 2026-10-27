import { useState } from "react";
import { MapPin } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

type Hospital = {
  id: number;
  lat: number;
  lon: number;
  tags?: { name?: string };
};

const Doctors = () => {
  const [nearbyDoctors, setNearbyDoctors] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);

  // ================================
  // Fetch hospitals around user
  // ================================
  const fetchNearbyDoctors = async (lat: number, lon: number) => {
    if (!lat || !lon) return;

    setLoading(true);

    const query = `
      [out:json][timeout:20];
      nwr["amenity"="hospital"](around:5000,${lat},${lon});
      out center;
    `;

    // teeno mirrors ko ek saath race karao, jo pehle jawab de wahi use hoga
    const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
    const timer = setTimeout(() => controllers.forEach((c) => c.abort()), 15000);

    let data: any = null;
    try {
      data = await Promise.any(
        OVERPASS_ENDPOINTS.map(async (url, i) => {
          const response = await fetch(url, {
            method: "POST",
            body: "data=" + encodeURIComponent(query),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            signal: controllers[i].signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          // winner mil gaya, baaki requests cancel
          controllers.forEach((c, j) => j !== i && c.abort());
          return json;
        })
      );
    } catch (error) {
      console.warn("All Overpass mirrors failed", error);
    } finally {
      clearTimeout(timer);
    }

    if (data) {
      // ways/relations me lat/lon `center` ke andar hota hai, normalize karo
      const hospitals = data.elements
        .map((el: any) => ({
          ...el,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
        }))
        .filter((el: any) => el.lat && el.lon);
      setNearbyDoctors(hospitals);
    } else {
      alert("Could not fetch nearby hospitals. Try again.");
    }

    setLoading(false);
  };

  // ================================
  // Auto detect user location
  // ================================
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchNearbyDoctors(latitude, longitude);
        },
        () => {
          alert("Location permission denied. Please allow location access.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // ================================
  // OPEN LOCATION IN GOOGLE MAPS
  // ================================
  const openLocation = (lat: number, lon: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-12 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* HEADER */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl font-bold mb-4">Find Nearby Doctors</h1>
            <p className="text-lg text-muted-foreground">
              Click the button below to see nearby hospitals and doctors.
            </p>
          </div>

          {/* LOCATION BUTTON */}
          <div className="flex justify-center mb-8">
            <Button
              onClick={getUserLocation}
              className="gradient-hero text-primary-foreground shadow-soft flex items-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Use My Location
            </Button>
          </div>

          {/* LOADING */}
          {loading && (
            <p className="text-center text-muted-foreground mb-4">
              Fetching nearby hospitals...
            </p>
          )}

          {/* RESULTS */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 ">
            {nearbyDoctors.length > 0 ? (
              nearbyDoctors.map((doctor) => (
                <Card
                  key={doctor.id}
                  className="card-hover animate-fade-in bg-white border-2 border-gray-300"
                >
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg">
                      {doctor.tags?.name || "Unnamed Hospital"}
                    </h3>

                    <p className="text-sm text-muted-foreground">
                      Coordinates: {doctor.lat}, {doctor.lon}
                    </p>

                    <Button
                      className="mt-2"
                      onClick={() => openLocation(doctor.lat, doctor.lon)}
                    >
                      See Location
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="card-hover animate-fade-in col-span-full">
                <CardContent className="p-6 text-center text-muted-foreground">
                  Nearby doctors and hospitals will appear here after searching.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Doctors;
