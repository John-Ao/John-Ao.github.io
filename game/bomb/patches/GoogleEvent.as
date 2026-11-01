package zlong.spilSystemTool
{
   import com.google.analytics.GATracker;
   import flash.display.DisplayObject;
   import flash.net.SharedObject;
   import zlong.IDestroyable;
   import zlong.framework_internal;
   import zlong.utils.SharedObjectUtil;

   use namespace framework_internal;

   public class GoogleEvent implements IDestroyable
   {

      private static var _instance:GoogleEvent;

      framework_internal static const VERSION:String = "v2.06.201112121715";

      private var _gaEventArr:Array;

      private var _gaGameName:String;

      private var _gaSharedObject:SharedObject;

      private var _gaTracker:GATracker;

      public function GoogleEvent(p:PrivateClass)
      {
         super();
      }

      public static function get instance() : GoogleEvent
      {
         if(_instance == null)
         {
            _instance = new GoogleEvent(new PrivateClass());
         }
         return _instance;
      }

      public function init(gameName:String, display:DisplayObject, debug:Boolean) : void
      {
         // Static offline port: no analytics or tracking storage.
      }

      public function gaTrackEvent(eventName:String, isRepeatedInOneGame:Boolean = false, isRepeatedInOnePC:Boolean = true) : void
      {
         // Static offline port: no analytics or tracking storage.
      }

      public function destroy() : void
      {
         this._gaTracker = null;
         this._gaEventArr = null;
         this._gaSharedObject = null;
         _instance = null;
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
