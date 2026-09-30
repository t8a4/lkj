 import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Brush, Upload } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

interface SpriteGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sprite: { name: string; url: string }) => void;
  onPaintNew: () => void;
}

interface SpriteItem {
  id: string;
  name: string;
  file?: string;
  url?: string;
}

const BUILTIN_SPRITES: SpriteItem[] = [
  { id: "logi", name: "Logi", file: "logi.png" },
  { id: "Aeroplane", name: "Aeroplane", file: "Aeroplane.svg" },
  { id: "Apple", name: "Apple", file: "Apple.svg" },
  { id: "Astronaut", name: "Astronaut", file: "Astronaut.svg" },
  { id: "Baby", name: "Baby", file: "Baby.svg" },
  { id: "Ball", name: "Ball", file: "Ball.svg" },
  { id: "Bank", name: "Bank", file: "Bank.svg" },
  { id: "Barn", name: "Barn", file: "Barn.svg" },
  { id: "Basketball", name: "Basketball", file: "Basketball.svg" },
  { id: "Bat", name: "Bat", file: "Bat.svg" },
  { id: "Bed", name: "Bed", file: "Bed.svg" },
  { id: "Bike", name: "Bike", file: "Bike.svg" },
  { id: "Bike2", name: "Bike2", file: "Bike2.svg" },
  { id: "Bird", name: "Bird", file: "Bird.svg" },
  { id: "Blue", name: "Blue", file: "Blue.svg" },
  { id: "boat_1", name: "boat_1", file: "boat_1.svg" },
  { id: "Boat2", name: "Boat2", file: "Boat2.svg" },
  { id: "Boy", name: "Boy", file: "Boy.svg" },
  { id: "Boy1", name: "Boy1", file: "Boy1.svg" },
  { id: "Boy2", name: "Boy2", file: "Boy2.svg" },
  { id: "Boy3", name: "Boy3", file: "Boy3.svg" },
  { id: "bus_1", name: "bus_1", file: "bus_1.svg" },
  { id: "Bus", name: "Bus", file: "Bus.svg" },
  { id: "Butterfly", name: "Butterfly", file: "Butterfly.svg" },
  { id: "Cactus", name: "Cactus", file: "Cactus.svg" },
  { id: "Cake", name: "Cake", file: "Cake.svg" },
  { id: "Camel", name: "Camel", file: "Camel.svg" },
  { id: "car_2", name: "car_2", file: "car_2.svg" },
  { id: "Car", name: "Car", file: "Car.svg" },
  { id: "Car1", name: "Car1", file: "Car1.svg" },
  { id: "Car2", name: "Car2", file: "Car2.svg" },
  { id: "Castle", name: "Castle", file: "Castle.svg" },
  { id: "cat_1", name: "cat_1", file: "cat_1.svg" },
  { id: "Cat", name: "Cat", file: "Cat.svg" },
  { id: "cat1", name: "cat1", file: "cat1.svg" },
  { id: "Chicken", name: "Chicken", file: "Chicken.svg" },
  { id: "Child1", name: "Child1", file: "Child1.svg" },
  { id: "Cloud1", name: "Cloud1", file: "Cloud1.svg" },
  { id: "Crab", name: "Crab", file: "Crab.svg" },
  { id: "Creek", name: "Creek", file: "Creek.svg" },
  { id: "CrescentMoon", name: "CrescentMoon", file: "CrescentMoon.svg" },
  { id: "Daffodil", name: "Daffodil", file: "Daffodil.svg" },
  { id: "Daisy1", name: "Daisy1", file: "Daisy1.svg" },
  { id: "Daisy2", name: "Daisy2", file: "Daisy2.svg" },
  { id: "Daisy3", name: "Daisy3", file: "Daisy3.svg" },
  { id: "dog_1", name: "dog_1", file: "dog_1.svg" },
  { id: "Dog", name: "Dog", file: "Dog.svg" },
  { id: "Dragon", name: "Dragon", file: "Dragon.svg" },
  { id: "Duck", name: "Duck", file: "Duck.svg" },
  { id: "Earth", name: "Earth", file: "Earth.svg" },
  { id: "elephant_1", name: "elephant_1", file: "elephant_1.svg" },
  { id: "Elephant", name: "Elephant", file: "Elephant.svg" },
  { id: "Evergreen", name: "Evergreen", file: "Evergreen.svg" },
  { id: "Fairy", name: "Fairy", file: "Fairy.svg" },
  { id: "Farmer", name: "Farmer", file: "Farmer.svg" },
  { id: "Farmer1", name: "Farmer1", file: "Farmer1.svg" },
  { id: "Father", name: "Father", file: "Father.svg" },
  { id: "Fence", name: "Fence", file: "Fence.svg" },
  { id: "Fish1", name: "Fish1", file: "Fish1.svg" },
  { id: "Fish2", name: "Fish2", file: "Fish2.svg" },
  { id: "Flowers", name: "Flowers", file: "Flowers.svg" },
  { id: "Fly", name: "Fly", file: "Fly.svg" },
  { id: "Fort", name: "Fort", file: "Fort.svg" },
  { id: "Frog", name: "Frog", file: "Frog.svg" },
  { id: "Giraffe", name: "Giraffe", file: "Giraffe.svg" },
  { id: "Girl", name: "Girl", file: "Girl.svg" },
  { id: "Girl1", name: "Girl1", file: "Girl1.svg" },
  { id: "Girl2", name: "Girl2", file: "Girl2.svg" },
  { id: "Girl3", name: "Girl3", file: "Girl3.svg" },
  { id: "Grandfather", name: "Grandfather", file: "Grandfather.svg" },
  { id: "Grandmother", name: "Grandmother", file: "Grandmother.svg" },
  { id: "Horse", name: "Horse", file: "Horse.svg" },
  { id: "House", name: "House", file: "House.svg" },
  { id: "House1", name: "House1", file: "House1.svg" },
  { id: "House3", name: "House3", file: "House3.svg" },
  { id: "House4", name: "House4", file: "House4.svg" },
  { id: "Inuit", name: "Inuit", file: "Inuit.svg" },
  { id: "lion_1", name: "lion_1", file: "lion_1.svg" },
  { id: "Lizard", name: "Lizard", file: "Lizard.svg" },
  { id: "Mailbox", name: "Mailbox", file: "Mailbox.svg" },
  { id: "monkey_1", name: "monkey_1", file: "monkey_1.svg" },
  { id: "Monkey", name: "Monkey", file: "Monkey.svg" },
  { id: "Moon", name: "Moon", file: "Moon.svg" },
  { id: "Mother", name: "Mother", file: "Mother.svg" },
  { id: "Mushroom", name: "Mushroom", file: "Mushroom.svg" },
  { id: "NightTable", name: "NightTable", file: "NightTable.svg" },
  { id: "pandamain", name: "pandamain", file: "pandamain.svg" },
  { id: "Peach", name: "Peach", file: "Peach.svg" },
  { id: "Penguin", name: "Penguin", file: "Penguin.svg" },
  { id: "Pig", name: "Pig", file: "Pig.svg" },
  { id: "Planet", name: "Planet", file: "Planet.svg" },
  { id: "PolarBear", name: "PolarBear", file: "PolarBear.svg" },
  { id: "Purple", name: "Purple", file: "Purple.svg" },
  { id: "Rabbit", name: "Rabbit", file: "Rabbit.svg" },
  { id: "Rancher", name: "Rancher", file: "Rancher.svg" },
  { id: "Red", name: "Red", file: "Red.svg" },
  { id: "Rocket", name: "Rocket", file: "Rocket.svg" },
  { id: "Rowboat", name: "Rowboat", file: "Rowboat.svg" },
  { id: "SailBoat", name: "SailBoat", file: "SailBoat.svg" },
  { id: "Scubadiver", name: "Scubadiver", file: "Scubadiver.svg" },
  { id: "Seahorse", name: "Seahorse", file: "Seahorse.svg" },
  { id: "ShootingStar", name: "ShootingStar", file: "ShootingStar.svg" },
  { id: "Shop", name: "Shop", file: "Shop.svg" },
  { id: "Snake", name: "Snake", file: "Snake.svg" },
  { id: "Soccerball", name: "Soccerball", file: "Soccerball.svg" },
  { id: "SoccerNet", name: "SoccerNet", file: "SoccerNet.svg" },
  { id: "Star", name: "Star", file: "Star.svg" },
  { id: "Star2", name: "Star2", file: "Star2.svg" },
  { id: "Star3", name: "Star3", file: "Star3.svg" },
  { id: "Starfish", name: "Starfish", file: "Starfish.svg" },
  { id: "Stool", name: "Stool", file: "Stool.svg" },
  { id: "Sun", name: "Sun", file: "Sun.svg" },
  { id: "Table", name: "Table", file: "Table.svg" },
  { id: "Teen2", name: "Teen2", file: "Teen2.svg" },
  { id: "Teen3", name: "Teen3", file: "Teen3.svg" },
  { id: "TeenBoy1", name: "TeenBoy1", file: "TeenBoy1.svg" },
  { id: "TeenBoy2", name: "TeenBoy2", file: "TeenBoy2.svg" },
  { id: "TeenBoy3", name: "TeenBoy3", file: "TeenBoy3.svg" },
  { id: "TeenGirl1", name: "TeenGirl1", file: "TeenGirl1.svg" },
  { id: "TeenGirl2", name: "TeenGirl2", file: "TeenGirl2.svg" },
  { id: "TeenGirl3", name: "TeenGirl3", file: "TeenGirl3.svg" },
  { id: "Thundercloud", name: "Thundercloud", file: "Thundercloud.svg" },
  { id: "tigercat", name: "tigercat", file: "tigercat.svg" },
  { id: "Tornado", name: "Tornado", file: "Tornado.svg" },
  { id: "Tree1", name: "Tree1", file: "Tree1.svg" },
  { id: "Tree2", name: "Tree2", file: "Tree2.svg" },
  { id: "Tree3", name: "Tree3", file: "Tree3.svg" },
  { id: "Tree4", name: "Tree4", file: "Tree4.svg" },
  { id: "Tulip2", name: "Tulip2", file: "Tulip2.svg" },
  { id: "Weed", name: "Weed", file: "Weed.svg" },
  { id: "Whale", name: "Whale", file: "Whale.svg" },
  { id: "Wizard", name: "Wizard", file: "Wizard.svg" },
  { id: "Zebra", name: "Zebra", file: "Zebra.svg" }
];

export function SpriteGallery({ isOpen, onClose, onSelect, onPaintNew }: SpriteGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [spritesList, setSpritesList] = useState<SpriteItem[]>(() => {
    try {
      const saved = localStorage.getItem('scratchjr_custom_sprites');
      if (saved) {
        const custom = JSON.parse(saved);
        return [...BUILTIN_SPRITES, ...custom];
      }
    } catch (e) {
      console.error('Error loading custom sprites from localStorage:', e);
    }
    return BUILTIN_SPRITES;
  });

  const [notification, setNotification] = useState<string | null>(null);

  const filteredSprites = spritesList.filter(sprite => {
    return sprite.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const existingNames = new Set(spritesList.map(s => s.name.trim().toLowerCase()));
    let addedCount = 0;
    let skippedCount = 0;
    const newItems: SpriteItem[] = [];

    const filePromises = files.map((file: File) => {
      return new Promise<{ name: string; dataUrl: string; skipped: boolean }>((resolve) => {
        const rawName = file.name.replace(/\.[^/.]+$/, '').trim();
        const lowerName = rawName.toLowerCase();

        if (existingNames.has(lowerName)) {
          skippedCount++;
          resolve({ name: rawName, dataUrl: '', skipped: true });
        } else {
          existingNames.add(lowerName);
          addedCount++;
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            resolve({ name: rawName, dataUrl, skipped: false });
          };
          reader.readAsDataURL(file);
        }
      });
    });

    Promise.all(filePromises).then(results => {
      const validUploads = results.filter(r => !r.skipped);

      if (validUploads.length > 0) {
        const newlyAddedSprites: SpriteItem[] = validUploads.map(u => ({
          id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: u.name,
          url: u.dataUrl
        }));

        setSpritesList(prev => {
          const updated = [...prev, ...newlyAddedSprites];
          try {
            const customOnly = updated.filter(s => s.id.startsWith('custom-'));
            localStorage.setItem('scratchjr_custom_sprites', JSON.stringify(customOnly));
          } catch (err) {
            console.error('Error saving to localStorage:', err);
          }
          return updated;
        });

        // Select the first new character automatically
        onSelect({ name: validUploads[0].name, url: validUploads[0].dataUrl });
      }

      if (skippedCount > 0 && addedCount > 0) {
        setNotification(`התווספו ${addedCount} דמויות. ${skippedCount} דמויות דולגו מכיוון ששמן כבר קיים בספרייה!`);
      } else if (skippedCount > 0 && addedCount === 0) {
        setNotification(`כל ${skippedCount} הדמויות דולגו מכיוון ששמן כבר קיים בספרייה!`);
      }

      if (validUploads.length > 0) {
        onClose();
      }
    });

    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 z-10"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800">Choose a new character</h2>
              <p className="text-slate-500 text-sm mt-1">Choose a character from the gallery, upload your own, or paint one!</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white hover:bg-slate-100 transition-colors shadow-sm text-slate-500 hover:text-slate-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search character... (e.g., Cat, Balloon, Car)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-400 focus:outline-none transition-colors text-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Sprites Grid */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {/* Upload character card */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <motion.div
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-dashed border-indigo-300 hover:border-indigo-400 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all h-36 relative group"
                >
                  <div className="w-20 h-20 flex items-center justify-center bg-white rounded-2xl group-hover:bg-indigo-100/40 transition-colors shadow-inner">
                    <div className="w-12 h-12 bg-indigo-400 rounded-full flex items-center justify-center shadow-md">
                      <Upload className="w-6 h-6 text-white stroke-[2.5]" />
                    </div>
                  </div>
                  <span className="text-indigo-700 font-extrabold text-sm tracking-tight truncate max-w-full">
                    Upload Character
                  </span>
                </motion.div>
              </label>

              {/* Create new character card */}
              <motion.div
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onClose();
                  onPaintNew();
                }}
                className="cursor-pointer bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-dashed border-orange-300 hover:border-orange-400 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all h-36 relative group"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-50/0 to-orange-50/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
                <div className="w-20 h-20 flex items-center justify-center bg-white rounded-2xl group-hover:bg-orange-100/40 transition-colors shadow-inner">
                  <div className="w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center shadow-md">
                    <Brush className="w-6 h-6 text-white stroke-[2.5]" />
                  </div>
                </div>
                <span className="text-orange-700 font-extrabold text-sm tracking-tight truncate max-w-full">
                  Create new character
                </span>
              </motion.div>

              {filteredSprites.map((sprite) => {
                const spriteUrl = sprite.url || getAssetUrl(`/sprites/${sprite.file}`);
                return (
                  <motion.div
                    key={sprite.id}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect({ name: sprite.name, url: spriteUrl })}
                    className="cursor-pointer bg-white border-2 border-slate-100 hover:border-orange-300 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all h-36 relative group"
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-orange-50/0 to-orange-50/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
                    <div className="w-20 h-20 flex items-center justify-center p-1 bg-slate-50 rounded-2xl group-hover:bg-orange-50/50 transition-colors">
                      <img
                        src={spriteUrl}
                        alt={sprite.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
                      />
                    </div>
                    <span className="text-slate-700 font-bold text-sm tracking-tight truncate max-w-full">
                      {sprite.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {notification && (
              <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-2xl text-amber-900 font-bold text-sm text-center">
                {notification}
              </div>
            )}

            {filteredSprites.length === 0 && searchQuery !== '' && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 mt-4">
                <Search className="w-10 h-10 opacity-30" />
                <span className="text-sm font-medium">No characters found matching your search</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
