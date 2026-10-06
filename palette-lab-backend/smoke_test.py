"""Manual, paid one-image test. Importing this module does not generate anything."""
import argparse
import json
from uuid import uuid4

from app import BASE_DIR, ENV_DIAGNOSTICS, generate_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-config', action='store_true', help='Print only key-presence/precedence booleans; no API call.')
    parser.add_argument('--description')
    parser.add_argument('--colours', nargs='+', help='Quote each #RRGGBB value.')
    args = parser.parse_args()
    if args.check_config:
        print(json.dumps(ENV_DIAGNOSTICS, indent=2))
        return
    if args.description is None or args.colours is None:
        parser.error('--description and --colours are required for generation')
    try:
        output_dir = BASE_DIR / 'outputs'
        output_dir.mkdir(exist_ok=True)
        image = generate_image(args.description, args.colours)
        output = output_dir / f'palette-{uuid4().hex}.png'
        with output.open('xb') as file:
            file.write(image)
    except (ValueError, RuntimeError) as error:
        parser.exit(1, f'{error}\n')
    except OSError:
        parser.exit(1, 'Could not save the local output. Check folder permissions.\n')
    print(f'Saved one image: {output}')


if __name__ == '__main__':
    main()
