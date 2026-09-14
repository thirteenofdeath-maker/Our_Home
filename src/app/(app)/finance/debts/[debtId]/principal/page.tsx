import { notFound } from "next/navigation";
import { getDebt } from "@/features/debts/api";
import { AdditionalDebtPrincipalForm } from "@/features/debts/components/DebtForms";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
export default async function Page({params}:{params:Promise<{debtId:string}>}){const{debtId}=await params;const{supabase,user}=await requireUser();const h=await getMyPrimaryHousehold(supabase,user.id);const d=await getDebt(supabase,debtId,h?.id);if(!d||d.archivedAt)notFound();const wallets=(await listMyWallets(supabase)).filter(x=>x.scope===d.scope&&x.currency===d.currency&&!x.is_archived);const pockets=Object.fromEntries(await Promise.all(wallets.map(async x=>[x.id,(await listPocketsForWallet(supabase,x.id)).filter(p=>!p.is_archived)]as const)));return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">เพิ่มเงินต้น: {d.name}</h1><AdditionalDebtPrincipalForm debtId={d.id} wallets={wallets} pockets={pockets}/></div>}
