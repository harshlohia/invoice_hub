import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { User, Building2, Palette, Bell, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><User className="mr-2 h-5 w-5 text-primary" /> Profile Information</CardTitle>
          <CardDescription>Update your personal and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" defaultValue="John" />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" defaultValue="Doe" />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" defaultValue="john.doe@example.com" />
          </div>
          <Button className="bg-primary hover:bg-primary/90">Save Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Building2 className="mr-2 h-5 w-5 text-primary" /> Business Information</CardTitle>
          <CardDescription>Manage your business details, GSTIN, and address for invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="businessName">Business Name</Label>
            <Input id="businessName" defaultValue="Acme Innovations Pvt. Ltd." />
          </div>
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input id="gstin" defaultValue="29AAAAA0000A1Z5" />
          </div>
           <div>
            <Label htmlFor="businessAddress">Business Address</Label>
            <Input id="businessAddress" defaultValue="123 Tech Park, Bangalore, KA 560001" />
          </div>
          <Button className="bg-primary hover:bg-primary/90">Save Business Info</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Invoice Templates</CardTitle>
          <CardDescription>Customize the look and feel of your invoices. (Coming Soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Advanced template customization options will be available here.</p>
           <Button variant="outline" disabled>Manage Templates</Button>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Notifications</CardTitle>
          <CardDescription>Manage your notification preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications" className="flex flex-col space-y-1">
                    <span>Email Notifications</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Receive email updates for important events.
                    </span>
                </Label>
                <Switch id="emailNotifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="paymentReminders" className="flex flex-col space-y-1">
                    <span>Payment Reminders</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Automatically send payment reminders for overdue invoices.
                    </span>
                </Label>
                <Switch id="paymentReminders" />
            </div>
          <Button className="bg-primary hover:bg-primary/90">Save Notification Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" /> Security</CardTitle>
          <CardDescription>Manage your account security settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Button variant="outline">Change Password</Button>
            </div>
            <div>
                <Button variant="outline" disabled>Enable Two-Factor Authentication</Button>
                 <p className="text-xs text-muted-foreground mt-1">Coming soon.</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
