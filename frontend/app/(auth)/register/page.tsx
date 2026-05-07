"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const registerSchema = z.object({
  school_name: z.string().min(2, "School name is required"),
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().regex(/^(98|97|96)\d{8}$/, "Valid Nepal phone number required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
  district: z.string().min(1, "District is required"),
  municipality: z.string().min(1, "Municipality is required"),
}).refine((d) => d.password === d.confirm_password, { message: "Passwords don't match", path: ["confirm_password"] });

type RegisterForm = z.infer<typeof registerSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: data.school_name,
          full_name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.password,
          district: data.district,
          municipality: data.municipality,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Registration failed"); return; }
      toast.success("Registration successful! Please verify your phone.");
      router.push(`/verify-otp?phone=${encodeURIComponent(data.phone)}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2">A</div>
        <CardTitle className="text-2xl">Create Your School</CardTitle>
        <CardDescription>Register your school on ASchool platform</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="school_name">School Name</Label>
            <Input id="school_name" placeholder="Nepal Model School" {...form.register("school_name")} />
            {form.formState.errors.school_name && <p className="text-sm text-destructive">{form.formState.errors.school_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Your Full Name</Label>
            <Input id="name" placeholder="Ram Bahadur Thapa" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@school.edu.np" {...form.register("email")} />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="98XXXXXXXX" {...form.register("phone")} maxLength={10} />
              {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input id="district" placeholder="Kathmandu" {...form.register("district")} />
              {form.formState.errors.district && <p className="text-sm text-destructive">{form.formState.errors.district.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipality">Municipality</Label>
              <Input id="municipality" placeholder="Kathmandu Metro" {...form.register("municipality")} />
              {form.formState.errors.municipality && <p className="text-sm text-destructive">{form.formState.errors.municipality.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input id="confirm_password" type="password" placeholder="••••••••" {...form.register("confirm_password")} />
            {form.formState.errors.confirm_password && <p className="text-sm text-destructive">{form.formState.errors.confirm_password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Create School Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline">Sign in</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
