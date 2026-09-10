-- 0050_default_system_categories.sql
-- Global, ownerless default categories. User categories keep their existing ownership contract.

alter table public.categories add column system_key text;
alter table public.categories alter column scope drop not null;
alter table public.categories alter column created_by drop not null;
alter table public.categories drop constraint categories_scope_ownership_chk;

alter table public.categories add constraint categories_system_key_unique unique (system_key);
alter table public.categories add constraint categories_system_or_user_chk check (
  (
    is_system
    and system_key is not null
    and scope is null
    and owner_user_id is null
    and household_id is null
    and created_by is null
  )
  or
  (
    not is_system
    and system_key is null
    and created_by is not null
    and scope is not null
    and (
      (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
      or (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
    )
  )
);

comment on column public.categories.system_key is
  'Stable machine identifier for global system categories; always NULL for user categories.';

-- Roots use increments of 1000 and children increments of 10 so additions do not
-- require renumbering the pack. Names intentionally contain no presentation emoji.
with roots(system_key, name, transaction_type, sort_order) as (values
  ('expense.food','อาหารและเครื่องดื่ม','EXPENSE'::public.category_transaction_type,1000),
  ('expense.home','บ้านและที่อยู่อาศัย','EXPENSE'::public.category_transaction_type,2000),
  ('expense.utilities','ค่าสาธารณูปโภค','EXPENSE'::public.category_transaction_type,3000),
  ('expense.transport','การเดินทางและรถ','EXPENSE'::public.category_transaction_type,4000),
  ('expense.health','สุขภาพ','EXPENSE'::public.category_transaction_type,5000),
  ('expense.fitness','ฟิตเนสและโภชนาการ','EXPENSE'::public.category_transaction_type,6000),
  ('expense.personal','ของใช้ส่วนตัว','EXPENSE'::public.category_transaction_type,7000),
  ('expense.pets','สัตว์เลี้ยง','EXPENSE'::public.category_transaction_type,8000),
  ('expense.shopping','ช้อปปิ้ง','EXPENSE'::public.category_transaction_type,9000),
  ('expense.entertainment','บันเทิงและงานอดิเรก','EXPENSE'::public.category_transaction_type,10000),
  ('expense.subscription','Subscription','EXPENSE'::public.category_transaction_type,11000),
  ('expense.family','คู่รักและครอบครัว','EXPENSE'::public.category_transaction_type,12000),
  ('expense.gifts','ของขวัญและสังคม','EXPENSE'::public.category_transaction_type,13000),
  ('expense.travel','ท่องเที่ยว','EXPENSE'::public.category_transaction_type,14000),
  ('expense.education','การศึกษา','EXPENSE'::public.category_transaction_type,15000),
  ('expense.work','งานและธุรกิจ','EXPENSE'::public.category_transaction_type,16000),
  ('expense.insurance','ประกัน','EXPENSE'::public.category_transaction_type,17000),
  ('expense.tax','ภาษีและราชการ','EXPENSE'::public.category_transaction_type,18000),
  ('expense.finance_fees','การเงินและค่าธรรมเนียม','EXPENSE'::public.category_transaction_type,19000),
  ('expense.other','อื่น ๆ','EXPENSE'::public.category_transaction_type,20000),
  ('income.salary','เงินเดือน','INCOME'::public.category_transaction_type,1000),
  ('income.work_extra','รายได้เพิ่มเติมจากงาน','INCOME'::public.category_transaction_type,2000),
  ('income.bonus','โบนัส','INCOME'::public.category_transaction_type,3000),
  ('income.freelance','ฟรีแลนซ์และงานเสริม','INCOME'::public.category_transaction_type,4000),
  ('income.business','ธุรกิจ','INCOME'::public.category_transaction_type,5000),
  ('income.investment','การลงทุน','INCOME'::public.category_transaction_type,6000),
  ('income.deposit_interest','ดอกเบี้ยเงินฝาก','INCOME'::public.category_transaction_type,7000),
  ('income.rental','ค่าเช่าและทรัพย์สิน','INCOME'::public.category_transaction_type,8000),
  ('income.sales','ขายของ','INCOME'::public.category_transaction_type,9000),
  ('income.received','เงินได้รับ','INCOME'::public.category_transaction_type,10000),
  ('income.rewards','รางวัลและสิทธิประโยชน์','INCOME'::public.category_transaction_type,11000),
  ('income.benefits','สวัสดิการและเงินชดเชย','INCOME'::public.category_transaction_type,12000),
  ('income.other','รายได้อื่น','INCOME'::public.category_transaction_type,13000)
)
insert into public.categories
  (system_key,name,transaction_type,sort_order,is_system,scope,owner_user_id,household_id,created_by)
select system_key,name,transaction_type,sort_order,true,null,null,null,null from roots
on conflict (system_key) do update set
  name=excluded.name, transaction_type=excluded.transaction_type, sort_order=excluded.sort_order;

with children(system_key, parent_key, name, transaction_type, sort_order) as (values
  ('expense.food.meals','expense.food','อาหารมื้อหลัก','EXPENSE'::public.category_transaction_type,10),
  ('expense.food.restaurants','expense.food','ร้านอาหาร','EXPENSE'::public.category_transaction_type,20),
  ('expense.food.delivery','expense.food','เดลิเวอรี','EXPENSE'::public.category_transaction_type,30),
  ('expense.food.snacks','expense.food','ของกินเล่นและขนม','EXPENSE'::public.category_transaction_type,40),
  ('expense.food.drinks','expense.food','กาแฟ ชา และเครื่องดื่ม','EXPENSE'::public.category_transaction_type,50),
  ('expense.food.ingredients','expense.food','วัตถุดิบทำอาหาร','EXPENSE'::public.category_transaction_type,60),
  ('expense.food.groceries','expense.food','ของชำและซูเปอร์มาร์เก็ต','EXPENSE'::public.category_transaction_type,70),
  ('expense.home.rent','expense.home','ค่าเช่า','EXPENSE'::public.category_transaction_type,10),
  ('expense.home.common_fee','expense.home','ค่าส่วนกลาง','EXPENSE'::public.category_transaction_type,30),
  ('expense.home.furniture','expense.home','เฟอร์นิเจอร์และของแต่งบ้าน','EXPENSE'::public.category_transaction_type,40),
  ('expense.home.appliances','expense.home','เครื่องใช้ไฟฟ้า','EXPENSE'::public.category_transaction_type,50),
  ('expense.home.supplies','expense.home','ของใช้ในบ้าน','EXPENSE'::public.category_transaction_type,60),
  ('expense.home.repairs','expense.home','ซ่อมแซมบ้าน','EXPENSE'::public.category_transaction_type,70),
  ('expense.home.cleaning','expense.home','ทำความสะอาดและแม่บ้าน','EXPENSE'::public.category_transaction_type,80),
  ('expense.utilities.electricity','expense.utilities','ค่าไฟ','EXPENSE'::public.category_transaction_type,10),
  ('expense.utilities.water','expense.utilities','ค่าน้ำ','EXPENSE'::public.category_transaction_type,20),
  ('expense.utilities.internet','expense.utilities','อินเทอร์เน็ตบ้าน','EXPENSE'::public.category_transaction_type,30),
  ('expense.utilities.mobile','expense.utilities','โทรศัพท์มือถือ','EXPENSE'::public.category_transaction_type,40),
  ('expense.utilities.gas','expense.utilities','ค่าแก๊ส','EXPENSE'::public.category_transaction_type,50),
  ('expense.utilities.other','expense.utilities','ค่าสาธารณูปโภคอื่น','EXPENSE'::public.category_transaction_type,60),
  ('expense.transport.fuel','expense.transport','น้ำมัน','EXPENSE'::public.category_transaction_type,10),
  ('expense.transport.public','expense.transport','รถสาธารณะ','EXPENSE'::public.category_transaction_type,20),
  ('expense.transport.ride_hailing','expense.transport','Taxi Grab Bolt','EXPENSE'::public.category_transaction_type,30),
  ('expense.transport.tolls','expense.transport','ทางด่วน','EXPENSE'::public.category_transaction_type,40),
  ('expense.transport.parking','expense.transport','ที่จอดรถ','EXPENSE'::public.category_transaction_type,50),
  ('expense.transport.maintenance','expense.transport','ซ่อมและบำรุงรถ','EXPENSE'::public.category_transaction_type,70),
  ('expense.transport.insurance','expense.transport','ประกันรถ','EXPENSE'::public.category_transaction_type,80),
  ('expense.transport.registration','expense.transport','พ.ร.บ. และภาษีรถ','EXPENSE'::public.category_transaction_type,90),
  ('expense.health.medical','expense.health','โรงพยาบาลและแพทย์','EXPENSE'::public.category_transaction_type,10),
  ('expense.health.dental','expense.health','ทันตกรรม','EXPENSE'::public.category_transaction_type,20),
  ('expense.health.medicine','expense.health','ยา','EXPENSE'::public.category_transaction_type,30),
  ('expense.health.checkup','expense.health','ตรวจสุขภาพ','EXPENSE'::public.category_transaction_type,40),
  ('expense.health.vision','expense.health','แว่นตาและคอนแทคเลนส์','EXPENSE'::public.category_transaction_type,50),
  ('expense.health.therapy','expense.health','กายภาพและการรักษา','EXPENSE'::public.category_transaction_type,60),
  ('expense.health.equipment','expense.health','อุปกรณ์สุขภาพ','EXPENSE'::public.category_transaction_type,70),
  ('expense.fitness.gym','expense.fitness','ยิม','EXPENSE'::public.category_transaction_type,10),
  ('expense.fitness.sports','expense.fitness','กีฬา','EXPENSE'::public.category_transaction_type,20),
  ('expense.fitness.equipment','expense.fitness','อุปกรณ์ออกกำลังกาย','EXPENSE'::public.category_transaction_type,30),
  ('expense.fitness.nutrition','expense.fitness','โปรตีนและโภชนาการ','EXPENSE'::public.category_transaction_type,40),
  ('expense.fitness.supplements','expense.fitness','อาหารเสริม','EXPENSE'::public.category_transaction_type,50),
  ('expense.personal.clothing','expense.personal','เสื้อผ้า','EXPENSE'::public.category_transaction_type,10),
  ('expense.personal.shoes','expense.personal','รองเท้า','EXPENSE'::public.category_transaction_type,20),
  ('expense.personal.bags','expense.personal','กระเป๋า','EXPENSE'::public.category_transaction_type,30),
  ('expense.personal.cosmetics','expense.personal','เครื่องสำอาง','EXPENSE'::public.category_transaction_type,40),
  ('expense.personal.skincare','expense.personal','สกินแคร์','EXPENSE'::public.category_transaction_type,50),
  ('expense.personal.grooming','expense.personal','ตัดผมและเสริมสวย','EXPENSE'::public.category_transaction_type,60),
  ('expense.personal.other','expense.personal','ของใช้ส่วนตัวอื่น','EXPENSE'::public.category_transaction_type,70),
  ('expense.pets.food','expense.pets','อาหารสัตว์','EXPENSE'::public.category_transaction_type,10),
  ('expense.pets.treats','expense.pets','ขนมสัตว์เลี้ยง','EXPENSE'::public.category_transaction_type,20),
  ('expense.pets.litter','expense.pets','ทรายและวัสดุรอง','EXPENSE'::public.category_transaction_type,30),
  ('expense.pets.supplies','expense.pets','ของใช้และอุปกรณ์สัตว์เลี้ยง','EXPENSE'::public.category_transaction_type,40),
  ('expense.pets.vet','expense.pets','สัตวแพทย์','EXPENSE'::public.category_transaction_type,50),
  ('expense.pets.medicine','expense.pets','ยาและวัคซีนสัตว์','EXPENSE'::public.category_transaction_type,60),
  ('expense.pets.grooming','expense.pets','อาบน้ำและ Grooming','EXPENSE'::public.category_transaction_type,70),
  ('expense.pets.toys','expense.pets','ของเล่นสัตว์เลี้ยง','EXPENSE'::public.category_transaction_type,80),
  ('expense.shopping.gadgets','expense.shopping','Gadget และอิเล็กทรอนิกส์','EXPENSE'::public.category_transaction_type,10),
  ('expense.shopping.computers','expense.shopping','คอมพิวเตอร์และเกมมิ่ง','EXPENSE'::public.category_transaction_type,20),
  ('expense.shopping.online','expense.shopping','ซื้อของออนไลน์','EXPENSE'::public.category_transaction_type,30),
  ('expense.shopping.collectibles','expense.shopping','ของสะสม','EXPENSE'::public.category_transaction_type,40),
  ('expense.shopping.general','expense.shopping','ของใช้ทั่วไป','EXPENSE'::public.category_transaction_type,50),
  ('expense.entertainment.games','expense.entertainment','เกม','EXPENSE'::public.category_transaction_type,10),
  ('expense.entertainment.movies','expense.entertainment','หนังและโรงภาพยนตร์','EXPENSE'::public.category_transaction_type,20),
  ('expense.entertainment.events','expense.entertainment','คอนเสิร์ตและอีเวนต์','EXPENSE'::public.category_transaction_type,30),
  ('expense.entertainment.media','expense.entertainment','หนังสือและสื่อ','EXPENSE'::public.category_transaction_type,40),
  ('expense.entertainment.hobbies','expense.entertainment','งานอดิเรก','EXPENSE'::public.category_transaction_type,50),
  ('expense.entertainment.leisure','expense.entertainment','กิจกรรมพักผ่อน','EXPENSE'::public.category_transaction_type,60),
  ('expense.subscription.streaming','expense.subscription','Streaming','EXPENSE'::public.category_transaction_type,10),
  ('expense.subscription.music','expense.subscription','Music','EXPENSE'::public.category_transaction_type,20),
  ('expense.subscription.cloud','expense.subscription','Cloud และ Storage','EXPENSE'::public.category_transaction_type,30),
  ('expense.subscription.software','expense.subscription','Software และ App','EXPENSE'::public.category_transaction_type,40),
  ('expense.subscription.ai','expense.subscription','AI Services','EXPENSE'::public.category_transaction_type,50),
  ('expense.subscription.gaming','expense.subscription','Gaming Subscription','EXPENSE'::public.category_transaction_type,60),
  ('expense.subscription.other','expense.subscription','Membership อื่น','EXPENSE'::public.category_transaction_type,70),
  ('expense.family.dates','expense.family','เดตและกินเที่ยว','EXPENSE'::public.category_transaction_type,10),
  ('expense.family.partner','expense.family','ค่าใช้จ่ายร่วมกับคู่รัก','EXPENSE'::public.category_transaction_type,20),
  ('expense.family.parents','expense.family','ดูแลพ่อแม่และครอบครัว','EXPENSE'::public.category_transaction_type,30),
  ('expense.family.children','expense.family','ค่าใช้จ่ายบุตร','EXPENSE'::public.category_transaction_type,40),
  ('expense.family.relatives','expense.family','ค่าใช้จ่ายญาติ','EXPENSE'::public.category_transaction_type,50),
  ('expense.gifts.gifts','expense.gifts','ของขวัญ','EXPENSE'::public.category_transaction_type,10),
  ('expense.gifts.social','expense.gifts','เลี้ยงเพื่อนและสังคม','EXPENSE'::public.category_transaction_type,20),
  ('expense.gifts.ceremonies','expense.gifts','งานแต่ง งานบวช และงานพิธี','EXPENSE'::public.category_transaction_type,30),
  ('expense.gifts.funeral','expense.gifts','งานศพ','EXPENSE'::public.category_transaction_type,40),
  ('expense.gifts.donation','expense.gifts','บริจาคและทำบุญ','EXPENSE'::public.category_transaction_type,50),
  ('expense.travel.accommodation','expense.travel','ที่พัก','EXPENSE'::public.category_transaction_type,10),
  ('expense.travel.flights','expense.travel','ตั๋วเครื่องบิน','EXPENSE'::public.category_transaction_type,20),
  ('expense.travel.transport','expense.travel','การเดินทางระหว่างท่องเที่ยว','EXPENSE'::public.category_transaction_type,30),
  ('expense.travel.food','expense.travel','อาหารระหว่างท่องเที่ยว','EXPENSE'::public.category_transaction_type,40),
  ('expense.travel.activities','expense.travel','กิจกรรมและค่าเข้า','EXPENSE'::public.category_transaction_type,50),
  ('expense.travel.shopping','expense.travel','ช้อปปิ้งระหว่างท่องเที่ยว','EXPENSE'::public.category_transaction_type,60),
  ('expense.education.tuition','expense.education','ค่าเรียนและคอร์ส','EXPENSE'::public.category_transaction_type,10),
  ('expense.education.materials','expense.education','หนังสือและสื่อการเรียน','EXPENSE'::public.category_transaction_type,20),
  ('expense.education.exams','expense.education','ค่าสอบและใบรับรอง','EXPENSE'::public.category_transaction_type,30),
  ('expense.education.equipment','expense.education','อุปกรณ์การเรียน','EXPENSE'::public.category_transaction_type,40),
  ('expense.work.equipment','expense.work','อุปกรณ์ทำงาน','EXPENSE'::public.category_transaction_type,10),
  ('expense.work.travel','expense.work','ค่าเดินทางเพื่อทำงาน','EXPENSE'::public.category_transaction_type,20),
  ('expense.work.software','expense.work','Software สำหรับงาน','EXPENSE'::public.category_transaction_type,30),
  ('expense.work.business','expense.work','ค่าใช้จ่ายธุรกิจ','EXPENSE'::public.category_transaction_type,40),
  ('expense.work.clients','expense.work','ลูกค้าและการรับรอง','EXPENSE'::public.category_transaction_type,50),
  ('expense.work.services','expense.work','บริการสำหรับงาน','EXPENSE'::public.category_transaction_type,60),
  ('expense.insurance.life','expense.insurance','ประกันชีวิต','EXPENSE'::public.category_transaction_type,10),
  ('expense.insurance.health','expense.insurance','ประกันสุขภาพ','EXPENSE'::public.category_transaction_type,20),
  ('expense.insurance.accident','expense.insurance','ประกันอุบัติเหตุ','EXPENSE'::public.category_transaction_type,30),
  ('expense.insurance.property','expense.insurance','ประกันทรัพย์สิน','EXPENSE'::public.category_transaction_type,40),
  ('expense.insurance.other','expense.insurance','ประกันอื่น','EXPENSE'::public.category_transaction_type,50),
  ('expense.tax.income','expense.tax','ภาษีเงินได้','EXPENSE'::public.category_transaction_type,10),
  ('expense.tax.government_fees','expense.tax','ค่าธรรมเนียมราชการ','EXPENSE'::public.category_transaction_type,20),
  ('expense.tax.documents','expense.tax','เอกสารและใบอนุญาต','EXPENSE'::public.category_transaction_type,30),
  ('expense.tax.fines','expense.tax','ค่าปรับ','EXPENSE'::public.category_transaction_type,40),
  ('expense.finance_fees.bank','expense.finance_fees','ค่าธรรมเนียมธนาคาร','EXPENSE'::public.category_transaction_type,10),
  ('expense.finance_fees.card','expense.finance_fees','ค่าธรรมเนียมบัตร','EXPENSE'::public.category_transaction_type,20),
  ('expense.finance_fees.card_interest','expense.finance_fees','ดอกเบี้ยบัตรเครดิต','EXPENSE'::public.category_transaction_type,30),
  ('expense.finance_fees.loan_interest','expense.finance_fees','ดอกเบี้ยเงินกู้','EXPENSE'::public.category_transaction_type,40),
  ('expense.finance_fees.penalties','expense.finance_fees','ค่าปรับทางการเงิน','EXPENSE'::public.category_transaction_type,50),
  ('expense.finance_fees.investment','expense.finance_fees','ค่าธรรมเนียมการลงทุน','EXPENSE'::public.category_transaction_type,60),
  ('expense.finance_fees.other','expense.finance_fees','ค่าธรรมเนียมอื่น','EXPENSE'::public.category_transaction_type,70),
  ('expense.other.irregular','expense.other','ค่าใช้จ่ายไม่ประจำ','EXPENSE'::public.category_transaction_type,10),
  ('expense.other.loss','expense.other','เงินหายและความสูญเสีย','EXPENSE'::public.category_transaction_type,20),
  ('expense.other.other','expense.other','ค่าใช้จ่ายอื่น','EXPENSE'::public.category_transaction_type,30),
  ('income.salary.regular','income.salary','เงินเดือนประจำ','INCOME'::public.category_transaction_type,10),
  ('income.salary.wages','income.salary','ค่าจ้าง','INCOME'::public.category_transaction_type,20),
  ('income.work_extra.ot','income.work_extra','OT','INCOME'::public.category_transaction_type,10),
  ('income.work_extra.shift','income.work_extra','ค่ากะ','INCOME'::public.category_transaction_type,20),
  ('income.work_extra.allowance','income.work_extra','เบี้ยเลี้ยง','INCOME'::public.category_transaction_type,30),
  ('income.work_extra.incentive','income.work_extra','Incentive','INCOME'::public.category_transaction_type,40),
  ('income.work_extra.commission','income.work_extra','Commission','INCOME'::public.category_transaction_type,50),
  ('income.bonus.annual','income.bonus','โบนัสประจำปี','INCOME'::public.category_transaction_type,10),
  ('income.bonus.special','income.bonus','โบนัสพิเศษ','INCOME'::public.category_transaction_type,20),
  ('income.freelance.freelance','income.freelance','Freelance','INCOME'::public.category_transaction_type,10),
  ('income.freelance.contract','income.freelance','รับจ้าง','INCOME'::public.category_transaction_type,20),
  ('income.freelance.online','income.freelance','งานออนไลน์','INCOME'::public.category_transaction_type,30),
  ('income.freelance.project','income.freelance','Project','INCOME'::public.category_transaction_type,40),
  ('income.business.sales','income.business','ยอดขาย','INCOME'::public.category_transaction_type,10),
  ('income.business.services','income.business','ค่าบริการ','INCOME'::public.category_transaction_type,20),
  ('income.business.other','income.business','รายได้ธุรกิจอื่น','INCOME'::public.category_transaction_type,30),
  ('income.investment.dividend','income.investment','เงินปันผล','INCOME'::public.category_transaction_type,10),
  ('income.investment.interest','income.investment','ดอกเบี้ยจากการลงทุน','INCOME'::public.category_transaction_type,20),
  ('income.investment.gain','income.investment','กำไรจากการลงทุน','INCOME'::public.category_transaction_type,30),
  ('income.investment.distribution','income.investment','Distribution','INCOME'::public.category_transaction_type,40),
  ('income.deposit_interest.bank','income.deposit_interest','ดอกเบี้ยบัญชีธนาคาร','INCOME'::public.category_transaction_type,10),
  ('income.deposit_interest.other','income.deposit_interest','ดอกเบี้ยเงินฝากอื่น','INCOME'::public.category_transaction_type,20),
  ('income.rental.home','income.rental','ค่าเช่าบ้านและห้อง','INCOME'::public.category_transaction_type,10),
  ('income.rental.other','income.rental','ค่าเช่าทรัพย์สินอื่น','INCOME'::public.category_transaction_type,20),
  ('income.sales.used','income.sales','ขายของมือสอง','INCOME'::public.category_transaction_type,10),
  ('income.sales.products','income.sales','ขายสินค้า','INCOME'::public.category_transaction_type,20),
  ('income.received.gift','income.received','ของขวัญเป็นเงิน','INCOME'::public.category_transaction_type,10),
  ('income.received.family','income.received','เงินจากครอบครัว','INCOME'::public.category_transaction_type,20),
  ('income.received.support','income.received','เงินสนับสนุน','INCOME'::public.category_transaction_type,30),
  ('income.rewards.cashback','income.rewards','Cashback','INCOME'::public.category_transaction_type,10),
  ('income.rewards.reward','income.rewards','Reward','INCOME'::public.category_transaction_type,20),
  ('income.rewards.prize','income.rewards','เงินรางวัล','INCOME'::public.category_transaction_type,30),
  ('income.rewards.promotion','income.rewards','Promotion','INCOME'::public.category_transaction_type,40),
  ('income.benefits.company','income.benefits','สวัสดิการบริษัท','INCOME'::public.category_transaction_type,10),
  ('income.benefits.government','income.benefits','เงินช่วยเหลือรัฐ','INCOME'::public.category_transaction_type,20),
  ('income.benefits.compensation','income.benefits','เงินชดเชย','INCOME'::public.category_transaction_type,30),
  ('income.benefits.insurance','income.benefits','ประกันจ่าย','INCOME'::public.category_transaction_type,40),
  ('income.benefits.tax_refund','income.benefits','คืนภาษี','INCOME'::public.category_transaction_type,50),
  ('income.other.special','income.other','รายได้พิเศษ','INCOME'::public.category_transaction_type,10),
  ('income.other.irregular','income.other','รายรับไม่ประจำ','INCOME'::public.category_transaction_type,20),
  ('income.other.other','income.other','รายได้อื่น','INCOME'::public.category_transaction_type,30)
)
insert into public.categories
  (system_key,name,transaction_type,parent_id,sort_order,is_system,scope,owner_user_id,household_id,created_by)
select c.system_key,c.name,c.transaction_type,p.id,c.sort_order,true,null,null,null,null
from children c join public.categories p on p.system_key=c.parent_key
on conflict (system_key) do update set
  name=excluded.name, transaction_type=excluded.transaction_type,
  parent_id=excluded.parent_id, sort_order=excluded.sort_order;
