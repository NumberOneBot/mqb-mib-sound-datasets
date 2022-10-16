# MQB MIB2 Sound Settings

Every ZDC container for MIB2 units contains several datasets describing car's sound system and equalizer finetuning for installed speakers. The most important are two sets located at 0x003000 (Audio Sound) and 0x003B00 (Audio Sound Configuration) adresses. MIB1 cars have very similar dataset located at 0x001000 address.

This repository is meant to research the details of them. The results were published in this [article](https://mqb-blog.com/en/2022/02/21/sound-dataset/).

## Requirements
- A MQB platform vehicle
- Hex-editing skills
- [010 editor](https://www.sweetscape.com/010editor/)
