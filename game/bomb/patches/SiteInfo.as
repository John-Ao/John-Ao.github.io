package zlong.localization
{
   import flash.events.Event;
   import flash.events.IOErrorEvent;
   import flash.events.SecurityErrorEvent;
   import flash.external.ExternalInterface;
   import flash.net.URLLoader;
   import flash.net.URLLoaderDataFormat;
   import flash.net.URLRequest;
   import zlong.IDestroyable;
   import zlong.localComponent_internal;

   use namespace localComponent_internal;

   public class SiteInfo implements IDestroyable
   {

      private static var _localSiteDataLoader:URLLoader;

      private static var _Instance:SiteInfo;

      localComponent_internal static const VERSION:String = "v1.17.201202091641";

      private static var _localSiteDataLoaderFinish:Boolean = true;

      private var _domain:String;

      private var _allowed:Boolean;

      private var _html:String;

      private var _sites:Array;

      private var _link:String;

      public function SiteInfo(p:PrivateClass)
      {
         super();
         this.reInit();
      }

      private static function onErrorHandler(e:Event = null) : void
      {
         SiteData.allowedSite = <sites></sites>;
         _localSiteDataLoaderFinish = true;
         SiteInfo.Instance.reInit();
         delLocalSiteDataLoader();
      }

      private static function delLocalSiteDataLoader() : void
      {
         _localSiteDataLoader.removeEventListener(IOErrorEvent.IO_ERROR,onErrorHandler);
         _localSiteDataLoader.removeEventListener(Event.COMPLETE,onLocalSiteDataLoaderFinishHandler);
         _localSiteDataLoader.removeEventListener(SecurityErrorEvent.SECURITY_ERROR,onErrorHandler);
         _localSiteDataLoader = null;
      }

      private static function onLocalSiteDataLoaderFinishHandler(event:Event) : void
      {
         SiteData.allowedSite = new XML(_localSiteDataLoader.data);
         _localSiteDataLoaderFinish = true;
         SiteInfo.Instance.reInit();
         delLocalSiteDataLoader();
      }

      public static function get localSiteDataLoaderFinish() : Boolean
      {
         return _localSiteDataLoaderFinish;
      }

      public static function get Instance() : SiteInfo
      {
         if(_Instance == null)
         {
            _Instance = new SiteInfo(new PrivateClass());
         }
         return _Instance;
      }

      localComponent_internal static function loadDataFromWeb() : void
      {
         _localSiteDataLoaderFinish = true;
      }

      private function getURL() : String
      {
         return "";
      }

      public function destroy() : void
      {
         this._sites = null;
         _Instance = null;
      }

      public function get domain() : String
      {
         return this._domain;
      }

      public function get link() : String
      {
         return this._link;
      }

      public function get allowed() : Boolean
      {
         if(GameInfo.cnversion)
         {
            return true;
         }
         return this._allowed;
      }

      private function initSites() : void
      {
         var siteList:XMLList = null;
         var i:int = 0;
         this._sites = new Array();
         if(SiteData.allowedSite != null)
         {
            siteList = SiteData.allowedSite.child("item");
            for(i = 0; i < siteList.length(); i++)
            {
               this._sites.push(siteList[i].toString());
            }
         }
      }

      private function getHtmlInUrl(str:String) : String
      {
         var index:int = str.indexOf("?");
         if(index != -1)
         {
            return str;
         }
         return str.substr(0,index);
      }

      private function getDomainInUrl(w:String) : String
      {
         var temp:String = "";
         for(var j:uint = 7; j < w.length; j++)
         {
            if(w.charAt(j) == "/")
            {
               break;
            }
            temp += w.charAt(j);
         }
         return temp;
      }

      public function get html() : String
      {
         return this._html;
      }

      internal function reInit() : void
      {
         this.initSites();
         this._link = this.getURL();
         this._html = this.getHtmlInUrl(this._link);
         this._domain = this.getDomainInUrl(this._link);
         this._allowed = this._sites.indexOf(this._domain) != -1;
      }
   }
}

class PrivateClass
{

   public function PrivateClass()
   {
      super();
   }
}
