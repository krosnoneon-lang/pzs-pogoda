import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./config";
import { Prognoza, TOTAL_FRAMES, timeline } from "./Prognoza";
import type { Forecast } from "./types";
import sample from "../public/data/forecast.json";
import { PrognozaMapa, timeline2 } from "./PrognozaMapa";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="PrognozaMapa"
      component={PrognozaMapa}
      durationInFrames={timeline2().TOTAL}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={sample as unknown as Forecast}
      calculateMetadata={({ props }) => ({ durationInFrames: timeline2(props).TOTAL })}
    />
    <Composition
      id="PrognozaPogody"
      component={Prognoza}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={sample as unknown as Forecast}
      calculateMetadata={({ props }) => ({ durationInFrames: timeline(props).TOTAL_FRAMES })}
    />
    </>
  );
};
