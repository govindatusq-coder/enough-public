import {z} from 'zod';
import {valueAreas} from './types.ts';
import {patternIds} from '../load/types.ts';
export const valuesMapSchema=z.object({
 values:z.array(z.object({key:z.enum(valueAreas),source:z.enum(['user','inferred']),confidence:z.number().min(0).max(1)}).strict()).max(20),
 goals:z.array(z.object({id:z.string().min(1).max(60),text:z.string().trim().min(1).max(120),kind:z.enum(['goal','responsibility','non_negotiable']),area:z.enum(['work','family','home','money','health','me']).nullable().optional(),createdAt:z.string().max(40)}).strict()).max(30),
 learnedPriorities:z.array(z.object({pattern:z.enum(patternIds),importanceShift:z.number(),aversion:z.number(),confidence:z.number()}).strict()).max(20).optional(),
}).strict();
