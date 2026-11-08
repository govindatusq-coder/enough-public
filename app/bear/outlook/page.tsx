import type {Metadata} from 'next';
import {OutlookPane} from '@/components/bear/outlook-pane';
export const metadata:Metadata={title:'Load Bear for Outlook',robots:{index:false}};
// The Outlook task pane (opened by the "Give to Bear" button the add-in manifest adds to Outlook).
export default function OutlookPage(){return <OutlookPane/>;}
