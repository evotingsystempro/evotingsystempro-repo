import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

// Map your sounds here
const SOUND_FILES = {
  beep: require("../assets/notification/beep.wav"),
  notification: require("../assets/notification/notification.wav"),
};

type SoundName = keyof typeof SOUND_FILES;

export function useNotificationSound() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentSoundName = useRef<SoundName | null>(null);

  const play = async (name: SoundName = "notification") => {
    try {
      // If a different sound is requested, unload old one
      if (currentSoundName.current !== name && soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Load sound if not already loaded
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name]);
        soundRef.current = sound;
        currentSoundName.current = name;
      }

      await soundRef.current.replayAsync();
    } catch (err) {
      console.log("Sound error:", err);
    }
  };

  const stop = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
      }
    } catch (err) {
      console.log("Stop error:", err);
    }
  };

  const unload = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        currentSoundName.current = null;
      }
    } catch (err) {
      console.log("Unload error:", err);
    }
  };

  useEffect(() => {
    return () => {
      unload();
    };
  }, []);

  return { play, stop, unload };
}
