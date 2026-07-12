import { HttpStatus } from '@nestjs/common';

interface PostgreSqlError{code?:string;constraint?:string;column?:string;table?:string}
export interface MappedDatabaseError{status:number;message:string}

export function mapPostgresError(error:unknown):MappedDatabaseError|null{
  if(!error||typeof error!=='object')return null;
  const value=error as PostgreSqlError,constraint=(value.constraint??'').toLowerCase();
  if(value.code==='23505'){
    if(constraint.includes('slug'))return{status:HttpStatus.CONFLICT,message:'هذا الرابط مستخدم مسبقًا'};
    if(constraint.includes('sku'))return{status:HttpStatus.CONFLICT,message:'SKU مستخدم مسبقًا'};
    if(constraint.includes('barcode'))return{status:HttpStatus.CONFLICT,message:'Barcode مستخدم مسبقًا'};
    return{status:HttpStatus.CONFLICT,message:'توجد قيمة مكررة لحقل يجب أن يكون فريدًا'};
  }
  if(value.code==='23503'){
    if(constraint.includes('category'))return{status:HttpStatus.BAD_REQUEST,message:'التصنيف المحدد غير موجود أو لم يعد متاحًا'};
    if(constraint.includes('brand'))return{status:HttpStatus.BAD_REQUEST,message:'العلامة التجارية المحددة غير موجودة أو لم تعد متاحة'};
    return{status:HttpStatus.BAD_REQUEST,message:'أحد السجلات المرتبطة غير موجود أو لا يمكن استخدامه'};
  }
  if(value.code==='23514')return{status:HttpStatus.BAD_REQUEST,message:'إحدى القيم لا تحقق القيود المطلوبة'};
  if(value.code==='23502')return{status:HttpStatus.BAD_REQUEST,message:`الحقل المطلوب ${value.column??''} لا يمكن أن يكون فارغًا`.trim()};
  return null;
}
