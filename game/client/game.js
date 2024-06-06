'use strict'
const Game = (() => {
    const game = {
        onLoading: null,
        onRunning: null,
        onFinish: null,
        onError: null,

        start: async (canvas, host, tokens) => {
            // Prevent asynchonous race conditions
            if (mStatus !== kStatus_None && mStatus !== kStatus_Finished && mStatus !== kStatus_Error)
                throw errorWithMessage('Attempt to start game multiple times');
            mStatus = kStatus_Loading;
            game.onLoading && game.onLoading();

            try {
                // Determine the game socket's address
                if (location.protocol !== 'https:' && location.protocol !== 'http:')
                    throw errorWithMessage('Unsupported protocol');
                let address = location.protocol.replace('http', 'ws')
                    .concat(
                        '//', host,
                        ...tokens.map((token, index) =>
                            `${index === 0 ? "?" : "&"}with_token=${token}`
                        )
                    );

                // Get a 2D drawing context
                mCanvas = canvas;
                mContext = canvas.getContext('2d');
                if (mContext === null || mContext === undefined)
                    throw errorWithMessage('Unable to get 2D drawing context');

                // Reset interpolation state
                mLastUpdateTime = null;
                mNextUpdateTime = null;
                mAverageUpdateDelta = null;

                // Try to connect to the game server
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(errorWithMessage('Timeout during connection attempt'));
                        try {
                            mSocket.close();
                        } catch {}
                    }, 2500);

                    mSocket = new WebSocket(address);
                    mSocket.binaryType = 'arraybuffer';
                    mSocket.onmessage = event => {
                        clearTimeout(timeout);
                        resolve(mSocket);
                        onSocketMessage(event);
                    };
                    mSocket.onclose = () => {
                        clearTimeout(timeout);
                        reject(errorWithMessage('Unable to connect to server'));
                    };
                });
                mSocket.onmessage = onSocketMessage;
                mSocket.onclose = onSocketClose;

                // TODO: The animation loop is started when interpolation is ready,
                //       create a timeout to handle the case where the server does not send any updates
            } catch (error) {
                if (error instanceof Error && error.withMessage === true)
                    game.onError && game.onError(error.message);
                else
                    game.onError && game.onError('Unable to start game');
            }
        }
    };

    // Constants; these should match with the server's code
    const kPhase_Waiting = 0, kPhase_Playing = 1, kPhase_Intermission = 2, kPhase_Finished = 3;
    const kStatus_None = 0, kStatus_Loading = 1, kStatus_Running = 2, kStatus_Finished = 3, kStatus_Error = 4;
    const kWorldAspect = 4.0 / 3.0, kWorldHeight = 40.0, kWorldWidth = kWorldHeight * kWorldAspect, kPaddleHeight = 8.0;

    // Resources for drawing and networking
    let mStatus = kStatus_None;
    let mCanvas;
    let mContext;
    let mSocket;

    // World-to-screen transformation parameters
    let mViewClip;
    let mViewWidth;
    let mViewHeight;
    let mViewMatrix = {b: 0.0, c: 0.0};

    // Game state
    let mPhase;
    let mBallX, mBallY;
    let mScoreA, mScoreB;
    let mPaddleA, mPaddleB;

    // Game interpolation
    let mLastUpdateTime;
    let mNextUpdateTime;
    let mAverageUpdateDelta;
    let mLastBallX, mLastBallY;
    let mLastPaddleA, mLastPaddleB;
    let mNextBallX, mNextBallY;
    let mNextPaddleA, mNextPaddleB;

    /** Creates an Error object with a usable message */
    function errorWithMessage(message) {
        const error = new Error(message);
        error.withMessage = true;
        return error;
    }

    function interpolate() {
        // Calculate the interpolation time
        let time = (performance.now() - mNextUpdateTime) / mAverageUpdateDelta;
        if (time < 0.0) time = 0.0;
        if (time > 1.0) time = 1.0;

        function linear(lhs, rhs) {
            return lhs + (rhs - lhs) * time;
        }

        mBallX = linear(mLastBallX, mNextBallX);
        mBallY = linear(mLastBallY, mNextBallY);
        mPaddleA = linear(mLastPaddleA, mNextPaddleA);
        mPaddleB = linear(mLastPaddleB, mNextPaddleB);
    }

    function draw() {
        // TODO: Draw the score if mPhase == kPhase_Intermission

        // Clear the whole frame's background
        mContext.fillStyle = '#2e2e2e';
        mContext.fillRect(0, 0, mViewWidth, mViewHeight);

        // Prepare for drawing the game world
        mContext.save();
        mContext.setTransform(mViewMatrix);
        mContext.clip(mViewClip);

        // Clear the game world's background
        mContext.fillStyle = 'black';
        mContext.fillRect(-kWorldWidth / 2.0, -kWorldHeight / 2.0, kWorldWidth, kWorldHeight);

        // TODO: Draw the dividing line

        // Draw the ball and the paddles
        mContext.fillStyle = 'white';
        mContext.fillRect(mBallX - 0.5, mBallY - 0.5, 1.0, 1.0);
        mContext.fillRect(-kWorldWidth / 2.0, mPaddleA - kPaddleHeight / 2.0, 1.0, kPaddleHeight);
        mContext.fillRect(kWorldWidth / 2.0 - 1.0, mPaddleB - kPaddleHeight / 2.0, 1.0, kPaddleHeight);

        // Restore the drawing context's transform and clipping
        mContext.restore();
    }

    function onAnimationFrame() {
        if (mStatus !== kStatus_Loading && mStatus !== kStatus_Running)
            return;

        if (mCanvas.clientWidth !== mViewWidth || mCanvas.clientHeight !== mViewHeight) {
            mViewWidth = mCanvas.width = mCanvas.clientWidth;
            mViewHeight = mCanvas.height = mCanvas.clientHeight;

            // Build a view matrix that preserves the game world's aspect ratio
            const viewAspect = mViewWidth / mViewHeight;
            if (viewAspect > kWorldAspect)
                mViewMatrix.a = mViewMatrix.d = mViewHeight / kWorldHeight;
            else
                mViewMatrix.a = mViewMatrix.d = mViewWidth / (kWorldHeight * kWorldAspect);
            mViewMatrix.e = mViewWidth / 2.0;
            mViewMatrix.f = mViewHeight / 2.0;

            // Build the game world's clipping path
            mViewClip = new Path2D();
            mViewClip.rect(-kWorldWidth / 2.0, -kWorldHeight / 2.0, kWorldWidth, kWorldHeight);
        }

        // Draw the interpolated game state
        interpolate();
        draw();

        if (mStatus === kStatus_Loading) {
            // Transition into running state when the first frame is visible
            mStatus = kStatus_Running;
            game.onRunning && game.onRunning();
        }
        // Only continue to animate when the game is still running
        if (mStatus === kStatus_Running)
            requestAnimationFrame(onAnimationFrame);
    }

    function onSocketMessage(event) {
        const view = new DataView(event.data);
        const flags = view.getUint8(0);

        // Save the current state as the last state for interpolation
        mLastBallX = mNextBallX;
        mLastBallY = mNextBallY;
        mLastPaddleA = mNextPaddleA;
        mLastPaddleB = mNextPaddleB;
        mLastUpdateTime = mNextUpdateTime;
        mNextUpdateTime = performance.now();

        // Update all marked fields
        for (let offset = 1, bit = 0; bit < 8; bit++) {
            if ((flags & (1 << bit)) === 0)
                continue;
            switch (bit) {
                case 0: mPhase = view.getUint8(offset++); break;
                case 1:
                    mNextBallX = view.getFloat32(offset + 0, true);
                    mNextBallY = view.getFloat32(offset + 4, true);
                    offset += 8;
                    break;
                case 2: mScoreA = view.getUint8(offset++); break;
                case 3: mScoreB = view.getUint8(offset++); break;
                case 4:
                    mNextPaddleA = view.getFloat32(offset, true);
                    offset += 4;
                    break;
                case 5:
                    mNextPaddleB = view.getFloat32(offset, true);
                    offset += 4;
                    break;
            }
        }

        // If ball interpolation is disabled, set both positions to the same value
        if (flags & (1 << 6)) {
            mLastBallX = mNextBallX;
            mLastBallY = mNextBallY;
        }

        // Calculate the average update delta time
        if (mLastUpdateTime !== null && mNextUpdateTime !== null) {
            const updateDelta = mNextUpdateTime - mLastUpdateTime;
            if (mAverageUpdateDelta !== null)
                mAverageUpdateDelta = (mAverageUpdateDelta + updateDelta) / 2.0;
            else {
                mAverageUpdateDelta = updateDelta;
                // If the average update delta is ready, start animating
                requestAnimationFrame(onAnimationFrame);
            }
        }
    }

    function onSocketClose() {
        // TODO: Handle loss of connection
    }

    return game;
})();
