import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./config";
import { Prognoza, TOTAL_FRAMES, timeline } from "./Prognoza";
import type { Forecast } from "./types";
import sample from "../public/data/forecast.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PrognozaPogody"
      component={Prognoza}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={sample as Forecast}
      calculateMetadata={({ props }) => ({ durationInFrames: timeline(props).TOTAL_FRAMES })}
    />
  );
};
