import { useSchoolFeatures } from "@/hooks/useSchoolFeatures";
import { Loader2 } from "lucide-react";
import SchoolWebsite from "./SchoolWebsite";
import SchoolWebsiteIncoming from "./SchoolWebsiteIncoming";

export default function SchoolWebsiteManager() {
  const { features, loading } = useSchoolFeatures();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return features.school_website ? <SchoolWebsite /> : <SchoolWebsiteIncoming />;
}
