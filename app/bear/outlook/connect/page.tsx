import type {Metadata} from 'next';
import {OutlookConnect} from '@/components/bear/outlook-connect';
export const metadata:Metadata={title:'Sign in to Load Bear',robots:{index:false}};
// The sign-in window the Outlook pane opens. It hands a session back to the pane and closes.
export default function OutlookConnectPage(){return <OutlookConnect/>;}
