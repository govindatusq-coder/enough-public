// Bear in Outlook: turning the email someone has open into what Bear receives. Pure and testable; the
// task pane (components/bear/outlook-pane.tsx) reads the item with Office.js and calls these.
// The email is untrusted input: it is only ever read as text and sent through the same capture
// pipeline as everything else. Nothing is sent until the person taps "Give this to Bear".
// (No imports: this also runs in the Outlook pane, so it stays free of server code. The file types and
// size limit mirror services/capture.ts; a test keeps them in step.)
export const OUTLOOK_FILE_TYPES=['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'];
export const OUTLOOK_LIMITS={maxTextChars:20000,maxAttachments:5,maxAttachmentBytes:10*1024*1024,minImageBytes:15*1024};
export interface OutlookItem{subject?:string|null;from?:string|null;received?:string|null;body?:string|null}
export interface OutlookAttachment{id:string;name:string;contentType?:string|null;size:number;isInline?:boolean;attachmentType?:string|null}

// Subject and sender, then the body. Not the sent date: Bear would read it as a date in the email.
export function captureText(item:OutlookItem){
 const subject=clean(item.subject).slice(0,300);
 const body=trimQuoted(clean(item.body,true));
 const head=[subject&&`Subject: ${subject}`,item.from&&`From: ${clean(item.from).slice(0,120)}`].filter(Boolean).join('\n');
 return [head,body].filter(Boolean).join('\n\n').slice(0,OUTLOOK_LIMITS.maxTextChars).trim();
}
function clean(s:string|null|undefined,multiline=false){
 const t=String(s||'').replace(/ /g,' ').replace(/[​-‏﻿]/g,'');
 return multiline?t.replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim():t.replace(/\s+/g,' ').trim();
}
// Long reply chains repeat old messages; keep the newest one. Short emails are left alone.
function trimQuoted(body:string){
 if(body.length<4000)return body;
 const m=/\n(?:-{2,}\s*Original Message\s*-{2,}|From: .+\n(?:Sent|Date): .+|On .{6,80} wrote:)\n/i.exec(body);
 return m&&m.index>200?body.slice(0,m.index).trim():body;
}

const MIME_BY_EXT:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',heic:'image/heic',heif:'image/heif',webp:'image/webp',gif:'image/gif'};
export function mimeOf(a:Pick<OutlookAttachment,'name'|'contentType'>){
 const t=(a.contentType||'').toLowerCase().split(';')[0].trim();
 if(t&&t!=='application/octet-stream')return t;
 return MIME_BY_EXT[(a.name.split('.').pop()||'').toLowerCase()]||t||'application/octet-stream';
}
const ALLOWED=new Set<string>(OUTLOOK_FILE_TYPES);
// Only real files Bear can read: PDFs and pictures, not signatures, logos or linked cloud files.
export function readableAttachments(list:OutlookAttachment[]){
 return list.filter(a=>{
  const mime=mimeOf(a);
  if(a.attachmentType&&a.attachmentType.toLowerCase()!=='file')return false;
  if(!ALLOWED.has(mime)||a.size<=0||a.size>OUTLOOK_LIMITS.maxAttachmentBytes)return false;
  if(mime.startsWith('image/')&&(a.isInline||a.size<OUTLOOK_LIMITS.minImageBytes))return false;
  return true;
 }).slice(0,OUTLOOK_LIMITS.maxAttachments);
}
export function base64ToBytes(b64:string){
 const bin=atob(b64.replace(/\s+/g,''));const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
}

// A small per-device memory of what was already given, so tapping twice (or reopening the same email)
// says so instead of sending it again. Keyed by the item id, never the content.
export function givenKey(itemId:string|null|undefined){return itemId?'bear-outlook-given:'+itemId.slice(-80):null;}

// The add-in manifest (XML, the format every Outlook supports: web, new Outlook, Windows, Mac, iOS and
// Android). Built from the origin it is served from, so the preview and production each have their own.
export function outlookManifest(origin:string,opts:{id?:string;version?:string;preview?:boolean}={}){
 const o=origin.replace(/\/$/,'');const id=opts.id||'5b1f7d4e-2c8a-4e6b-9f3d-7a1c0b2e4d68';const v=opts.version||'1.0.0.0';
 const host=new URL(o).host;const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const pane=esc(`${o}/bear/outlook`);const icon=(n:number)=>esc(`${o}/outlook/icon-${n}.png`);
 const button=(formFactor:'desktop'|'mobile')=>formFactor==='desktop'?`
          <ExtensionPoint xsi:type="MessageReadCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="bearGroup">
                <Label resid="groupLabel"/>
                <Control xsi:type="Button" id="bearOpenPane">
                  <Label resid="buttonLabel"/>
                  <Supertip><Title resid="buttonLabel"/><Description resid="buttonTip"/></Supertip>
                  <Icon><bt:Image size="16" resid="icon16"/><bt:Image size="32" resid="icon32"/><bt:Image size="80" resid="icon80"/></Icon>
                  <Action xsi:type="ShowTaskpane"><SourceLocation resid="paneUrl"/><SupportsPinning>true</SupportsPinning></Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>`:`
          <ExtensionPoint xsi:type="MobileMessageReadCommandSurface">
            <Group id="bearMobileGroup">
              <Label resid="groupLabel"/>
              <Control xsi:type="MobileButton" id="bearMobileOpenPane">
                <Label resid="buttonLabel"/>
                <Icon xsi:type="bt:MobileIconList">
                  <bt:Image size="25" scale="1" resid="icon32"/><bt:Image size="25" scale="2" resid="icon80"/><bt:Image size="25" scale="3" resid="icon80"/>
                  <bt:Image size="32" scale="1" resid="icon32"/><bt:Image size="32" scale="2" resid="icon80"/><bt:Image size="32" scale="3" resid="icon80"/>
                  <bt:Image size="48" scale="1" resid="icon80"/><bt:Image size="48" scale="2" resid="icon80"/><bt:Image size="48" scale="3" resid="icon80"/>
                </Icon>
                <Action xsi:type="ShowTaskpane"><SourceLocation resid="paneUrl"/></Action>
              </Control>
            </Group>
          </ExtensionPoint>`;
 return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0" xsi:type="MailApp">
  <Id>${id}</Id>
  <Version>${v}</Version>
  <ProviderName>Load Bear</ProviderName>
  <DefaultLocale>en-AU</DefaultLocale>
  <DisplayName DefaultValue="Load Bear${opts.preview?' (preview)':''}"/>
  <Description DefaultValue="Give an email to Bear. Bear works out what it asks of you, and remembers it so you don’t have to."/>
  <IconUrl DefaultValue="${icon(64)}"/>
  <HighResolutionIconUrl DefaultValue="${icon(128)}"/>
  <SupportUrl DefaultValue="${esc(o)}/bear/outlook/help"/>
  <AppDomains>
    <AppDomain>${esc('https://'+host)}</AppDomain>
  </AppDomains>
  <Hosts><Host Name="Mailbox"/></Hosts>
  <Requirements><Sets><Set Name="Mailbox" MinVersion="1.1"/></Sets></Requirements>
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings><SourceLocation DefaultValue="${pane}"/><RequestedHeight>450</RequestedHeight></DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
  </Rule>
  <DisableEntityHighlighting>true</DisableEntityHighlighting>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides/1.1" xsi:type="VersionOverridesV1_1">
      <Requirements><bt:Sets DefaultMinVersion="1.5"><bt:Set Name="Mailbox"/></bt:Sets></Requirements>
      <Hosts>
        <Host xsi:type="MailHost">
          <DesktopFormFactor>${button('desktop')}
          </DesktopFormFactor>
          <MobileFormFactor>${button('mobile')}
          </MobileFormFactor>
        </Host>
      </Hosts>
      <Resources>
        <bt:Images>
          <bt:Image id="icon16" DefaultValue="${icon(16)}"/>
          <bt:Image id="icon32" DefaultValue="${icon(32)}"/>
          <bt:Image id="icon80" DefaultValue="${icon(80)}"/>
        </bt:Images>
        <bt:Urls>
          <bt:Url id="paneUrl" DefaultValue="${pane}"/>
        </bt:Urls>
        <bt:ShortStrings>
          <bt:String id="groupLabel" DefaultValue="Load Bear${opts.preview?' (preview)':''}"/>
          <bt:String id="buttonLabel" DefaultValue="Give to Bear"/>
        </bt:ShortStrings>
        <bt:LongStrings>
          <bt:String id="buttonTip" DefaultValue="Give this email to Bear. Bear works out what it asks of you and remembers it."/>
        </bt:LongStrings>
      </Resources>
    </VersionOverrides>
  </VersionOverrides>
</OfficeApp>
`;
}
