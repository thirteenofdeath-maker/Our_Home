import { describe, expect, it } from "vitest";
import { ageFromBirthday, MAX_PET_PHOTO_BYTES, petFormSchema, petInitials, petPhotoPath, validatePetPhoto } from "./pet";

const valid = { name:"Mochi", species:"RABBIT", breed:" Holland Lop ", sex:"MALE", birthday:"2020-01-01", caregiverIds:[] };
describe("pet identity validation",()=>{
  it("accepts and normalizes a valid pet",()=>{const result=petFormSchema.parse(valid);expect(result).toMatchObject({name:"Mochi",breed:"Holland Lop",species:"RABBIT",sex:"MALE"})});
  it("normalizes blank breed to null",()=>expect(petFormSchema.parse({...valid,breed:"  "}).breed).toBeNull());
  it("rejects blank name",()=>expect(petFormSchema.safeParse({...valid,name:"  "}).success).toBe(false));
  it("rejects invalid species and sex",()=>{expect(petFormSchema.safeParse({...valid,species:"HORSE"}).success).toBe(false);expect(petFormSchema.safeParse({...valid,sex:"NEUTERED"}).success).toBe(false)});
  it("rejects a future birthday",()=>expect(petFormSchema.safeParse({...valid,birthday:"2999-01-01"}).success).toBe(false));
  it("derives age without storing it",()=>expect(ageFromBirthday("2020-09-10",new Date(2026,8,9))).toBe(5));
});
describe("pet photo rules",()=>{
  it("scopes path to household and pet",()=>expect(petPhotoPath("household","pet","image/png")).toBe("household/pet/profile.png"));
  it.each(["image/jpeg","image/png","image/webp"] as const)("accepts %s",type=>expect(validatePetPhoto({type,size:MAX_PET_PHOTO_BYTES})).toBeNull());
  it("rejects bad MIME and files over 15 MB",()=>{expect(MAX_PET_PHOTO_BYTES).toBe(15*1024*1024);expect(validatePetPhoto({type:"image/gif",size:1})).toMatch(/JPEG/);expect(validatePetPhoto({type:"image/png",size:MAX_PET_PHOTO_BYTES+1})).toMatch(/15 MB/)});
  it("provides initials fallback",()=>expect(petInitials("โมจิ")).toBe("โม"));
});
