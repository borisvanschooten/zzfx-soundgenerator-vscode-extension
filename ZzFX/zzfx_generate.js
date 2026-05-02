const SeededRandom=_=>
(
    randomSeed ^= randomSeed << 13,
    randomSeed ^= randomSeed >> 17,
    randomSeed ^= randomSeed << 5,
    (randomSeed%1e9)/1e9
)
let randomSeed = Date.now();

// build a sound object with same defaults as zzfx
function BuildSound
(
    volume = 1, 
    randomness = .05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = .1,
    shape = 0,
    shapeCurve = 1,
    slide = 0, 
    deltaSlide = 0, 
    pitchJump = 0, 
    pitchJumpTime = 0, 
    repeatTime = 0, 
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
    filter = 0
)
{
    const sound = 
    {
        volume,
        randomness,
        frequency,
        attack,
        sustain,
        release,
        shape,
        shapeCurve,
        slide,
        deltaSlide,
        pitchJump,
        pitchJumpTime,
        repeatTime,
        noise,
        modulation,
        bitCrush,
        delay,
        sustainVolume,
        decay,
        tremolo,
        filter
    };

    return sound;
}

// convert sound parameters object to array
function SoundToArray(sound) {
	const defaultSound = BuildSound();
    // use default sound for keys and order
    const array = [];
    for(const key in defaultSound)
        array.push(sound[key]);
    return array;
}


function PlaySelected()
{
    if (lastPlayedSound)
    {
        try
        {
            const context = lastPlayedSound.context;
            const gain = context.createGain();

            lastPlayedSound.disconnect();
            lastPlayedSound.connect(gain);
            gain.connect(context.destination);

            const t = lastPlayedSound.context.currentTime + .02;
            gain.gain.linearRampToValueAtTime(1, t);
            gain.gain.linearRampToValueAtTime(0, t + .1);
        }
        catch (e) { lastPlayedSound.stop(); }
        
        lastPlayedSound = 0;
    }
    
    const sound = BuildSoundFromSettings();
    const params = SoundToArray(sound);
    
    if (ZZFX.volume > 0)
    {
        const samples = ZZFX.buildSamples(...params);
        lastPlayedSound = ZZFX.play(...params);
        DrawSoundWave(samples, ZZFX.volume, sound);
    }
    else
    {
        // just build samples without playing
        const saveVolume = ZZFX.volume;
        ZZFX.volume = 1;
        const samples = ZZFX.buildSamples(...params);
        DrawSoundWave(samples, 1, sound);
        ZZFX.volume = saveVolume;
    }
    RandomizeLogo();
}

function BuildSoundFromSettings()
{
    const sound = {};
    for(const s of settings)
    {
        let v = document.getElementById("input_"+s.name).value;
        if (s.type != SETTING_TYPE_NAME)
            v = parseFloat(v) || 0;
        
        sound[s.name] = v;
    }

    return sound;
}


function BuildRandomSound(RAND,lengthScale=1, volume=1, randomness=.05) {
    // generate a random sound
    const R=()=>RAND(), C=()=>R()<.5?R():0, S=()=>C()?1:-1,

    // randomize sound length
    attack  = R()**3/2*lengthScale,
    decay   = R()**3/2*lengthScale,
    sustain = R()**3/2*lengthScale,
    release = R()**3/2*lengthScale,
    length  = attack + decay + sustain + release,
    filter  = C()? 0 : R()<.5? 99+R()**2*900 : R()**2*1e3-1500;

    // create random sound
    return BuildSound (
       volume,          // volume
       randomness,      // randomness
       9+R()**2*1e3,    // frequency
       attack,          // attack
       sustain,         // sustain
       release,         // release
       R()*5|0,         // shape
       R()*5,           // shapeCurve
       C()**3*99*S(),   // slide
       C()**3*99*S(),   // deltaSlide
       C()**2*500*S(),  // pitchJump
       R()**2 * length, // pitchJumpTime
       C() * length/4,  // repeatTime
       C()**4,          // noise
       R()*C()**2*500,  // modulation
       C()**4,          // bitCrush
       C()**3/2,        // delay
       1 - R()*.5,      // sustain volume
       decay,           // decay
       C()**2*.5,       // tremolo
       filter           // filter
    );
}

function buildPresetSound(randomseed,presetName='Random') {
	var seed = parseInt(randomseed);
	var _mulberry32 = function(input) {
		var t = input += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return (t ^ t >>> 14) >>> 0;
	}
	var RAND = function() {
		seed = _mulberry32(seed);
		return (seed & 0x7fffffff) / 0x7fffffff;
	}
    let sound = BuildSound();
    const R =(a=1,b=0) => b+(a-b)*RAND();

    if (R()<.5) // apply random filter
        sound.filter = R()<.5 ? 99+R()**2*900 : R()**2*1e3-1500;
    sound.shapeCurve = R(sound.shape == 4 ? 9 : 4);
    
    switch (presetName)
    {
        case 'Random':
        {
            sound = BuildRandomSound(RAND);
            break;
        }
        case 'Default': break;
        case 'Pickup':
        {
            sound.frequency = R(200,700);
            sound.shape = R(2)|0;
            sound.attack = R(.03);
            sound.decay = R(.05);
            sound.sustain = R(.1);
            sound.sustainVolume = R(.5, 1);
            sound.release = R(.05,.2);
            sound.noise =  R()<.8 ? 0 : R(.5);
            if (R()<.5)
            {
                sound.pitchJump = R(99,500);
                sound.pitchJumpTime = R(.04,.1);
            }
            sound.slide = R()<.5 ? 0 : R(-1,1)**3*10;
            sound.deltaSlide = R()<.5 ? 0 : R(-1,1)**3*100;
            sound.repeatTime = R()<.5 ? 0 : R(.1);
            sound.bitCrush = R()<.5 ? 0 : R(.1);
            sound.delay = R()<.7 ? 0 : R(.1);
            sound.modulation = R()<.8 ? 0 : R()**2*50;
            break;
        }
        case 'Powerup':
        {
            sound.frequency = R(99,700);
            sound.shape = R(2)|0;
            sound.attack = R(.1);
            sound.decay = R(.1,.3);
            sound.sustain = R(.1,.3);
            sound.sustainVolume = R(.5, 1);
            sound.release = R(.05,.5);
            sound.delay = R()<.8 ? 0 : R(.2);
            sound.repeatTime = R(.01,.1);
            sound.slide = R()<.5 ? 0 : R(-1,1)**3*10;
            sound.deltaSlide = R()<.5 ? 0 : R(-1,1)**3*200;
            sound.noise =  R()<.8 ? 0 : R(.5);
            sound.bitCrush = R()<.5 ? 0 : R(.2);
            sound.tremolo = R()<.5 ? 0 : R(.5);
            sound.modulation = R()<.8 ? 0 : R()**2*50;
            if (R()<.5)
            {
                sound.pitchJump = sound.repeatTime && R()<.5 ? -R(50,200) : R(9,500);
                sound.pitchJumpTime = !sound.pitchJump ? 0 : R(.05,.1);
            }
            break;
        }
        case 'Jump':
        {
            sound.frequency = R(50,500);
            sound.shape = R(2)|0;
            sound.attack = R(.05);
            sound.decay = R(.1);
            sound.sustain = R(.1);
            sound.sustainVolume = R(.5, 1);
            sound.release = R(.05,.2);
            sound.noise =  R()<.5 ? 0 : R(1);
            sound.slide = R()<.5 ? 0 : R()**2*50;
            sound.deltaSlide = R()<.5 && sound.slide ? 0 : R(-50,99);
            sound.bitCrush = R()<.5 ? 0 : R(.1);
            sound.delay = R()<.8 ? 0 : R(.05);
            break;
        }
        case 'Shoot':
        {
            sound.frequency = R(50,500);
            sound.shape = R(4)|0;
            sound.attack = R(.03);
            sound.decay = R(.1,.2);
            sound.sustain = R(.2);
            sound.sustainVolume = R(.5, 1);
            sound.release = R(.05,.2);
            sound.delay = R()<.5 ? 0 : R(.3);
            sound.slide = R(-1,1)*20;
            sound.deltaSlide = R(-1,1)*20;
            sound.noise =  R()<.8 ? 0 : R(1);
            sound.modulation = R()<.8 ? 0 : R()**2*50;
            sound.bitCrush = R()<.5 ? 0 : R(.5);
            if (R()<.5)
            {
                sound.tremolo = R(.3);
                sound.repeatTime = R(.01,.1);
            }
            break;
        }
        case 'Blip':
        {
            sound = BuildRandomSound(RAND);
            sound.attack = R(.03);
            sound.decay = R(.03,.01);
            sound.sustain = R(.05);
            sound.release = R(.05);
            break;
        }
        case 'Hit':
        {
            sound.frequency = R(30,500);
            sound.shape = R(5)|0;
            sound.attack = R(.03);
            sound.decay = R(.1);
            sound.sustain = R(.1);
            sound.sustainVolume = R(.4, 1);
            sound.release = R(.3);
            sound.delay = R()<.5 ? 0 : R(.2);
            sound.slide = R()<.5 ? 0 : R(-1,1)**3*10;
            sound.deltaSlide = R()<.5 ? 0 : R(-1,1)**3*20;
            sound.noise = R(2);
            sound.modulation = R()<.8 ? 0 : R()**2*50;
            sound.bitCrush = R(.5);
            sound.tremolo = R()<.5 ? 0 : R(.5);
            if (sound.tremolo || R()<.5 && sound.pitchJump)
                sound.repeatTime = R(.01,.1);
            sound.filter = R()<.5 ? 0 : R()<.5 ? 99+R()**2*2e3 : R()**2*1e3-2500;
            break;
        }
        case 'Explo':
        {
            sound.frequency = R(30,99);
            sound.shape = R(5)|0;
            sound.attack = R(.1);
            sound.decay = R(.05,.3);
            sound.sustain = R(.3);
            sound.sustainVolume = R(.3, .5);
            sound.release = R(.3, .8);
            sound.slide = R()<.5 ? 0 : R(-9,9);
            sound.deltaSlide = R()<.5 ? 0 : R(-9,9);
            sound.delay = R()<.5 ? 0 : R(.5);
            sound.noise = R(2);
            sound.modulation = R()<.8 ? 0 : R()**2*99;
            sound.bitCrush = R(1,.1);
            sound.tremolo = R()<.5 ? 0 : R(.5);
            if (sound.tremolo || R()<.5 && sound.pitchJump)
                sound.repeatTime = R(.05,.3);
            sound.filter = R()<.5 ? 0 : R()<.5 ? 99+R()**2*2e3 : R()**2*2e3-3500;
            break;
        }
        case 'Music':
        {
            sound.frequency = noteScale[(R(3)|0)*7][0];
            sound.randomness = 0;
            sound.shape = R(3)|0;
            sound.attack = R()<.3 ? R(.05) : R(.2);
            sound.decay = R(.2);
            sound.sustain = R(1);
            sound.sustainVolume = R(.3, 1);
            sound.release = R(.05,.5);
            sound.delay = R()<.5 ? 0 : R(.2);
            sound.noise = R()<.3 ? 0 : R(.4);
            sound.bitCrush = R()<.3 ? 0 : R(.1);
            if (R()<.5)
            {
                // tremolo
                sound.repeatTime = R(.1,.4);
                sound.tremolo = R(.5);
            }
        }
    }

    // finalize settings
    if (!sound.pitchJumpTime || !sound.pitchJump)
        sound.pitchJumpTime = sound.pitchJump = 0;
    const length = sound.attack + sound.sustain + sound.delay;
    if (sound.repeatTime > length)
        sound.repeatTime = 0;
        
    const Fixed = (v,l=2) => {
        if (v>10 || v < -10)
            l = 0;
        const f = v.toFixed(l);
        return !parseFloat(f) ? 0 : f;
    }
     
    // convert to fixed point
    if (typeof sound.frequency != 'string')
        sound.frequency = Fixed(sound.frequency,0);
    sound.shapeCurve = Fixed(sound.shapeCurve,1);
    sound.attack = Fixed(sound.attack);
    sound.sustain = Fixed(sound.sustain);
    sound.release = Fixed(sound.release);
    sound.slide = Fixed(sound.slide,0);
    sound.deltaSlide = Fixed(sound.deltaSlide,0);
    sound.noise = Fixed(sound.noise,1);
    sound.pitchJump = Fixed(sound.pitchJump,0);
    sound.pitchJumpTime = Fixed(sound.pitchJumpTime);
    sound.repeatTime = Fixed(sound.repeatTime, 2);
    sound.modulation = Fixed(sound.modulation,1);
    sound.bitCrush = Fixed(sound.bitCrush,1);
    sound.delay = Fixed(sound.delay);
    sound.sustainVolume = Fixed(sound.sustainVolume);
    sound.decay = Fixed(sound.decay);
    sound.tremolo = Fixed(sound.tremolo);
    sound.filter = Fixed(sound.filter,0);

    // must have some release to prevent pop
    if (parseFloat(sound.release) == 0)
        sound.release = Fixed(R(.01),3);

    // renormalize sound volume
    var params = SoundToArray(sound);
    const saveVolume = ZZFX.volume;
    ZZFX.volume = 1;
    const samples = ZZFX.buildSamples(...params);
    ZZFX.volume = saveVolume;

    // get max sample
    let maxSample = 0;
    for(let i=0; i<samples.length; i++)
        maxSample = Math.max(maxSample, Math.abs(samples[i]));
    let volume = 1/maxSample;
    volume = Fixed(volume,1);
    if (volume > 1) // prevent rounding up causing sound to go above 1
        volume = Math.max(1, Fixed(volume - .01,1));

    volume = Math.min(5,volume);  // prevent too loud
    volume = Math.max(.1,volume); // prevent too quiet
    sound.volume = volume;
    
    //sound.name = presetName + ' ' + generatedSoundCount++;

    params = SoundToArray(sound);
	return {
		"sound": sound,
		"samples": ZZFX.buildSamples(...params),
	}
}


function GetCode(sound)
{
    // create code string
    const parameters = SoundToArray(sound);
        
    // remove defaults
    const littleJS = input_codeStyleLittleJS.checked;
    const shorten = littleJS || input_codeStyleCompact.checked;
    const defaults = SoundToArray(BuildSound());
    let isEnd = 1;
    for(let i = parameters.length-1; shorten&&i>=0; --i)
    {
        if (parameters[i] == defaults[i])
        {
            if (isEnd)
                --parameters.length;
            else
                parameters[i] = '';
        }
        else
            isEnd = 0;
    }
      
    // make parameters list
    let code = '';
    for(let i = 0; i < parameters.length; ++i)
    {
        let p = parameters[i].toString();
        // remove leading 0
        if (p.slice(0,2) == '0.')
            p = p.slice(1);
        
        if (!settings[i].type)
        {
            let e = parseFloat(parameters[i]).toExponential();
            e = e.replace('+','');
            
            if (e.length < p.length)
                p = e;
        }
            
        code += (i?',':'') + p;
    }
    
    if (!code.length && !littleJS)
        return `zzfx(${code}); // ${sound.name.trim()}`;
    else if (shorten)
    {
        if (littleJS)
            return `new Sound([${code}]); // ${sound.name.trim()}`;

        return `zzfx(...[${code}]); // ${sound.name.trim()}`;
    }
    else
        return `zzfx(${code}); // ${sound.name.trim()}`;
}

function SaveWave()
{
    PlaySelected();
    const sound = BuildSoundFromSettings();
    const v = ZZFX.volume;
    ZZFX.volume = .5;
    const samples = ZZFX.buildSamples(...SoundToArray(sound));
    ZZFX.volume = v;

    a_downloadLink.href = buildWavURL([samples], ZZFX.sampleRate);
    name = sound.name.trim();
    if (!name.length)
        name = 'zzfx';
    a_downloadLink.download = name + ".wav";
    a_downloadLink.click();
}

///////////////////////////////////////////////////////////////////////////////
// save & load

function BuildSaveData()
{
    const volume = slider_masterVolume.value;
    const codeStyle = 
        input_codeStyleCompact.checked ? 'compact' : 
        input_codeStyleLittleJS.checked ? 'littlejs' : 'full';

    const data =
    {
        sounds,
        generatedSoundCount,
        volume,
        codeStyle
    }
    
    return JSON.stringify(data);
}

function LoadSaveData(dataJSON)
{
    if (!dataJSON)
    {
        AddDefaultIfEmpty();
        return;
    }

    const data = JSON.parse(dataJSON);
    if (data.generatedSoundCount)
        generatedSoundCount = data.generatedSoundCount;
    if (data.sounds)
        data.sounds.forEach(o=>o&&AddToList(o));

    // settings
    if (data.volume)
        slider_masterVolume.value = data.volume;
    if (data.codeStyle)
    {
        if (data.codeStyle == 'full')
            input_codeStyleFull.checked = 1;
        if (data.codeStyle == 'compact')
            input_codeStyleCompact.checked = 1;
        if (data.codeStyle == 'littlejs')
            input_codeStyleLittleJS.checked = 1;
    }
        
    AddDefaultIfEmpty();
    select_soundList.selectedIndex = 0;
    LoadSelected();
    UpdateSettings();
}

function Export()
{
    const fileData = BuildSaveData();
    a_downloadLink.download = "zzfx_sounds.txt";
    a_downloadLink.href='data:application/octet-stream;charset=UTF-8,' + encodeURIComponent(fileData);
    a_downloadLink.click();
    PlaySelected();
}


