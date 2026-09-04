import { prisma } from "@/lib/db";
import { VehiclesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: [{ srNo: "asc" }, { plate: "asc" }] });
  return <VehiclesClient vehicles={vehicles} />;
}
