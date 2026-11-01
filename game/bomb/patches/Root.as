package
{
   import zlong.GameSetting;
   import zlong.IDestroyable;
   import zlong.Template.AbstractRootClass;
   import zlong.localization.PortalType;
   import zlong.spilSystemTool.GoogleEvent;
   import zlong.spilSystemTool.SpilSetting;

   [SWF(width="600", height="450", backgroundColor="#bec4cf", frameRate="30")]
   public class Root extends AbstractRootClass implements IDestroyable
   {

      public static const VERSION_NUM:String = "v.0.01";

      public static const __debug__:Boolean = false;

      public static const __loadXML__:Boolean = false;

      public static const __cheat__:Boolean = false;

      public static const STAGE_WIGHT:int = 600;

      public static const STAGE_HEIGHT:int = 450;

      public static const GAME_FRAMERATE:int = 30;

      public static const GAME_NAME:String = "Bomb_It_3";

      public static const PORTAL_TYPE:String = PortalType.PORTAL_TYPE_TWEEN;

      public static const LOADING_CLASS_NAME:String = "zlong.ui.UILoading";

      public static const GAME_CLASS_NAME:String = "Main";

      public static const SPIL_ID:String = "b7c387f0fd0f54f343e31047ab9dc9b8";

      public function Root()
      {
         super();
      }

      override protected function initSettingBeforeLoading() : void
      {
         new GameSetting(this,false,PORTAL_TYPE,cutGameName(GAME_NAME),null,STAGE_WIGHT,STAGE_HEIGHT);
         SpilSetting.__SKIP_SPIL_SDK__ = true;

      }

      override protected function script0() : void
      {
         Trace("script0");
      }

      override protected function script1() : void
      {
         Trace("script1");
      }

      override protected function script2() : void
      {
         Trace("script2");
      }
   }
}
