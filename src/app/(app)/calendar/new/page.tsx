import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold,listHouseholdMembers } from "@/features/household/api";
import { CalendarEventForm } from "@/features/calendar/components/CalendarEventForm";
import { requireUser } from "@/lib/auth/require-user";
export default async function NewCalendarEventPage(){const{supabase,user}=await requireUser();const household=await getMyPrimaryHousehold(supabase,user.id);const members=household?await listHouseholdMembers(supabase,household.id):[];return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">เพิ่มกิจกรรม</h1><Card><CalendarEventForm members={members}/></Card></div>}
