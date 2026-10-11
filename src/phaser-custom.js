// Phaser'ın yalnızca bu oyunun kullandığı parçalarını içeren özel giriş.
// vite.config.js'teki 'phaser' takma adı buraya bakar: oyun dosyaları `import Phaser from 'phaser'` yazmaya devam eder.
// Yeni bir Phaser özelliği kullanılacaksa (ör. this.add.graphics, this.load.audio, fizik) önce buraya eklenmeli;
// eklenmezse this.add.<tür> / this.load.<tür> "is not a function" hatası verir.
// Çıkarılanlar: fizik (Arcade/Matter), ses, tilemap, Graphics/BitmapText/Container ve diğer nesneler,
// gamepad, ışık eklentisi (Light2D), DOM öğesi, video, ek yükleyici türleri, Facebook/Camera3D eklentileri.

import CONST from 'phaser/src/const.js';
import Game from 'phaser/src/core/Game.js';
import Scene from 'phaser/src/scene/Scene.js';
import Scenes from 'phaser/src/scene/index.js'; // ScenePlugin (this.scene) dahil
import Scale from 'phaser/src/scale/index.js';
import Textures from 'phaser/src/textures/index.js';
import PhaserMath from 'phaser/src/math/index.js'; // core/Config zaten tamamını çağırıyor; ek yük getirmez
import InputEvents from 'phaser/src/input/events/index.js';
import Keyboard from 'phaser/src/input/keyboard/index.js'; // this.input.keyboard
import GetRandom from 'phaser/src/utils/array/GetRandom.js';

// Sahne eklentileri: içe alınınca kendilerini kaydederler (this.cameras, this.add, this.time, this.tweens...)
import 'phaser/src/events/EventEmitter.js'; // this.events; yoksa oyun "Core Plugins missing" ile durur
import 'phaser/src/cameras/2d/CameraManager.js';
import 'phaser/src/gameobjects/GameObjectFactory.js';
import 'phaser/src/gameobjects/GameObjectCreator.js';
import 'phaser/src/gameobjects/DisplayList.js';
import 'phaser/src/gameobjects/UpdateList.js';
import 'phaser/src/time/Clock.js';
import 'phaser/src/data/DataManagerPlugin.js';
import 'phaser/src/input/InputPlugin.js';
import 'phaser/src/loader/LoaderPlugin.js';
import 'phaser/src/tweens/TweenManager.js';

// Oyun nesneleri: this.add.image / sprite / rectangle / tileSprite / text / particles
import 'phaser/src/gameobjects/image/ImageFactory.js';
import 'phaser/src/gameobjects/sprite/SpriteFactory.js';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';
import 'phaser/src/gameobjects/tilesprite/TileSpriteFactory.js';
import 'phaser/src/gameobjects/text/TextFactory.js';
import 'phaser/src/gameobjects/particles/ParticleEmitterFactory.js';

// Yükleyici türleri: this.load.image / spritesheet
import 'phaser/src/loader/filetypes/ImageFile.js';
import 'phaser/src/loader/filetypes/SpriteSheetFile.js';

const Phaser = {
  ...CONST, // AUTO, WEBGL, CANVAS, VERSION, BlendModes, ScaleModes...
  Game,
  Scene,
  Scenes,
  Scale,
  Textures,
  Math: PhaserMath,
  Input: { Events: InputEvents, Keyboard },
  Utils: { Array: { GetRandom } },
};

export default Phaser;
