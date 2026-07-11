import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Sparkles } from "lucide-react";

export default function SchoolWebsiteIncoming() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" /> School Website
          <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" /> Incoming</Badge>
        </h1>
        <p className="text-muted-foreground">Build and manage a public website for your school.</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Globe className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-xl font-semibold">Coming Soon</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            You will soon be able to manage your school's own public website — with your school
            branding, news, admissions, gallery, staff and contact details — all strictly limited
            to your school's information.
          </p>
          <p className="text-sm text-muted-foreground">
            Watch this space. This module is in active development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
