package
{
   import actionSprite.Loader;
   import actionSprite.ui.UiManager;
   import actionSprite.ui.language;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.utils.getDefinitionByName;

   [SWF(width="600", height="450", backgroundColor="#cccccc", frameRate="40")]
   public class documentClass extends MovieClip
   {

      private var _cartoonMc:MovieClip;

      public function documentClass()
      {
         super();
         if(super.stage)
         {
            this.$init();
         }
         else
         {
            super.addEventListener(Event.ADDED_TO_STAGE,this.$init);
         }
      }

      private function init() : void
      {
         var _loc1_:String = null;
         var _loc2_:Class = null;
         var _loc3_:MovieClip = null;
         stage.frameRate = 40;
         language.Language = 16;
         _loc1_ = String("bgMasker");
         _loc2_ = getDefinitionByName(_loc1_) as Class;
         _loc3_ = MovieClip(new _loc2_());
         stage.addChild(_loc3_);
         stage.showDefaultContextMenu = false;
         stage.scaleMode = "noScale";
         stage.stageFocusRect = false;
         stage.tabChildren = false;
         stop();
         new Loader(this);
      }

      public function initItem() : void
      {
         this.gotoAndStop(2);
         this.gotoAndStop(1);
         stage.frameRate = 40;
         new UiManager(stage);
      }

      private function enterFrameHandle(param1:Event) : void
      {
         if(_cartoonMc.currentFrame == _cartoonMc.totalFrames)
         {
            stage.removeChild(_cartoonMc);
            _cartoonMc = null;
            stage.frameRate = 40;
            new UiManager(stage);
            stage.removeEventListener(Event.ENTER_FRAME,enterFrameHandle);
         }
      }

      private function $init(param1:Event = null) : void
      {
         super.removeEventListener(Event.ADDED_TO_STAGE,this.$init);
         init();
      }
   }
}
