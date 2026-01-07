import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PinsListTab } from "@/components/admin/pins/PinsListTab";
import { GeneratePinsTab } from "@/components/admin/pins/GeneratePinsTab";
import { PinUsageLogsTab } from "@/components/admin/pins/PinUsageLogsTab";
import { AssignPinsTab } from "@/components/admin/pins/AssignPinsTab";

const PinManagement = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PIN Management</h1>
        <p className="text-muted-foreground">
          Generate and manage result access PINs for students
        </p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">All PINs</TabsTrigger>
          <TabsTrigger value="generate">Generate PINs</TabsTrigger>
          <TabsTrigger value="assign">Assign to Students</TabsTrigger>
          <TabsTrigger value="logs">Usage Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <PinsListTab />
        </TabsContent>

        <TabsContent value="generate">
          <GeneratePinsTab />
        </TabsContent>

        <TabsContent value="assign">
          <AssignPinsTab />
        </TabsContent>

        <TabsContent value="logs">
          <PinUsageLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PinManagement;
